import { Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PaymentProvider } from '../../generated/prisma/enums.js';
import { defaultHttpPost, type HttpPost } from '../../lib/provider-http.js';
import {
  type CheckoutSession,
  type CreateCheckoutSessionInput,
  headerValue,
  type PaymentGateway,
  type RefundInput,
  type VerifiedEvent,
} from './gateway.js';
import { toAmountValue } from './money.js';

/** Chỉ sandbox cho capstone (không doanh thu — spec §1); test có thể override. */
const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';
/** Refresh OAuth token đang cache sớm bấy nhiêu trước thời điểm expiry ghi trên token. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export interface PayPalGatewayOptions {
  clientId: string;
  clientSecret: string;
  /** Webhook id từ cấu hình PayPal app — BẮT BUỘC để verify. */
  webhookId: string;
  /** Override cho test; mặc định là host API sandbox. */
  baseUrl?: string;
}

/**
 * Bản triển khai {@link PaymentGateway} cho PayPal (Orders v2, sandbox) — port
 * HÌNH DẠNG PayPalService của Nexora nhưng không dùng `@paypal/paypal-server-sdk`:
 * Nexora dùng SDK cho orders/refunds nhưng ĐÃ nói raw HTTP (fetch + token
 * client-credentials có cache) cho OAuth và verify webhook; v2 làm nốt hai
 * endpoint còn lại cũng bằng raw HTTP, qua seam {@link HttpPost} injectable để
 * mọi lời gọi unit-test được offline (D2: không network smoke trong P2).
 *
 * Verify webhook dùng API `verify-webhook-signature` của PayPal (khác Stripe,
 * REST webhook không có scheme HMAC offline) — một network call ở production,
 * một `httpPost` stub trong test. `custom_id` trên purchase unit là cầu nối
 * bookingId (đã được Nexora kiểm chứng), capture id trở thành
 * `providerPaymentId` (handle để refund).
 *
 * LƯU Ý trigger capture: đảo thứ tự ưu tiên so với Nexora. Nexora capture khi
 * buyer quay lại (`captureOrder` từ return endpoint), webhook chỉ làm backstop.
 * v2 lấy webhook `CHECKOUT.ORDER.APPROVED` (xử lý ở {@link followUp}, gọi SAU
 * khi PaymentEvent đã ghi audit) làm ĐƯỜNG CHÍNH — capture xảy ra dù buyer có
 * quay lại browser hay không, PayPal tự retry delivery nếu capture throw (an
 * toàn nhờ `PayPal-Request-Id` idempotent theo orderId). Return-page bước 10
 * (P3, web) chỉ còn là lớp UX — capture-nếu-chưa-capture, webhook đã lo phần
 * chắc chắn; y hệt Stripe không cần followUp vì `payment_intent.succeeded`
 * chỉ tới SAU khi Stripe đã tự capture.
 */
export class PayPalGateway implements PaymentGateway {
  readonly provider = PaymentProvider.PAYPAL;
  private readonly logger = new Logger(PayPalGateway.name);
  private readonly baseUrl: string;
  private cachedToken?: { token: string; expiresAt: number };

  constructor(
    private readonly options: PayPalGatewayOptions,
    private readonly httpPost: HttpPost = defaultHttpPost,
  ) {
    this.baseUrl = options.baseUrl ?? SANDBOX_BASE_URL;
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    const order = await this.post<OrderShape>('/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.code,
          custom_id: input.bookingId,
          description: input.description,
          amount: {
            currency_code: input.currency,
            value: toAmountValue(input.amount, input.currency),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Tourism',
            user_action: 'PAY_NOW',
            return_url: input.successUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    });

    const approveUrl = order.links?.find(
      (link) => link.rel === 'payer-action' || link.rel === 'approve',
    )?.href;
    if (!order.id || !approveUrl) {
      throw new Error(`PayPal order ${order.id ?? '<no id>'} has no approval link`);
    }
    this.logger.log(`Created PayPal order ${order.id} for booking ${input.code}`);
    return { sessionId: order.id, checkoutUrl: approveUrl };
  }

  async verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<VerifiedEvent> {
    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    let event: PayPalEventShape;
    try {
      event = JSON.parse(payload) as PayPalEventShape;
    } catch {
      throw new Error('PayPal webhook body is not JSON');
    }

    const verification = await this.post<{ verification_status?: string }>(
      '/v1/notifications/verify-webhook-signature',
      {
        auth_algo: headerValue(headers, 'paypal-auth-algo'),
        cert_url: headerValue(headers, 'paypal-cert-url'),
        transmission_id: headerValue(headers, 'paypal-transmission-id'),
        transmission_sig: headerValue(headers, 'paypal-transmission-sig'),
        transmission_time: headerValue(headers, 'paypal-transmission-time'),
        webhook_id: this.options.webhookId,
        webhook_event: event,
      },
    );
    if (verification.verification_status !== 'SUCCESS') {
      throw new Error(
        `PayPal webhook verification returned ${verification.verification_status ?? '<none>'}`,
      );
    }
    return mapPayPalEvent(event);
  }

  async refund(input: RefundInput): Promise<{ providerRefundId: string }> {
    const refund = await this.post<{ id?: string; status?: string }>(
      `/v2/payments/captures/${input.providerPaymentId}/refund`,
      {
        amount: {
          value: toAmountValue(input.amount, input.currency),
          currency_code: input.currency,
        },
      },
      input.idempotencyKey,
    );
    if (!refund.id) throw new Error('PayPal refund response has no id');
    this.logger.log(
      `Refunded PayPal capture ${input.providerPaymentId} → ${refund.id} (status=${refund.status ?? 'unknown'})`,
    );
    return { providerRefundId: refund.id };
  }

  /**
   * Side-effect sau verify: capture order khi webhook báo buyer đã APPROVED.
   * Đây là đường capture CHÍNH (xem docblock lớp) — throw lan ra ngoài để
   * controller trả 500, PayPal tự retry delivery này.
   */
  async followUp(event: VerifiedEvent): Promise<void> {
    const raw = event.raw as PayPalEventShape;
    if (raw.event_type !== 'CHECKOUT.ORDER.APPROVED') return;

    const orderId = raw.resource?.id;
    if (!orderId) {
      // Payload dị dạng nhưng ĐÃ verify chữ ký — không có gì để retry, chỉ ghi log.
      this.logger.warn(
        'PayPal CHECKOUT.ORDER.APPROVED webhook has no resource.id — bỏ qua capture',
      );
      return;
    }

    try {
      await this.post(`/v2/checkout/orders/${orderId}/capture`, {}, `capture:${orderId}`);
      this.logger.log(`Captured PayPal order ${orderId} theo webhook APPROVED`);
    } catch (error) {
      // ORDER_ALREADY_CAPTURED = capture đã thành công ở lượt trước (retry của
      // PayPal hoặc APPROVED đến sau) — idempotent, nuốt lỗi thay vì throw.
      if (error instanceof Error && error.message.includes('ORDER_ALREADY_CAPTURED')) {
        this.logger.log(`PayPal order ${orderId} đã được capture từ trước — no-op`);
        return;
      }
      throw error;
    }
  }

  // ── Nội bộ ─────────────────────────────────────────────────────────────

  /** JSON POST với Bearer auth; `PayPal-Request-Id` = idempotency phía provider. */
  private async post<T>(path: string, payload: unknown, requestId?: string): Promise<T> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    };
    if (requestId) headers['paypal-request-id'] = requestId;
    const response = await this.httpPost(`${this.baseUrl}${path}`, {
      headers,
      body: JSON.stringify(payload),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `PayPal ${path} failed (HTTP ${response.status}): ${paypalErrorMessage(response.body)}`,
      );
    }
    return JSON.parse(response.body) as T;
  }

  /** OAuth client-credentials token, cached until shortly before expiry (Nexora shape). */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + TOKEN_REFRESH_MARGIN_MS) {
      return this.cachedToken.token;
    }
    const basic = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString(
      'base64',
    );
    const response = await this.httpPost(`${this.baseUrl}/v1/oauth2/token`, {
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`PayPal OAuth token request failed: HTTP ${response.status}`);
    }
    const json = JSON.parse(response.body) as {
      access_token: string;
      expires_in: number;
    };
    this.cachedToken = {
      token: json.access_token,
      expiresAt: now + json.expires_in * 1000,
    };
    return json.access_token;
  }
}

/** Fields we read off a created order. */
interface OrderShape {
  id?: string;
  links?: { href: string; rel: string }[];
}

/** Fields we read off a verified webhook event (everything else rides in `raw`). */
interface PayPalEventShape {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
  };
}

/**
 * Verified PayPal event → provider-neutral {@link VerifiedEvent}:
 * - `PAYMENT.CAPTURE.COMPLETED` → `payment.completed` — `custom_id` (set at
 *   order create) → bookingId, capture `resource.id` → providerPaymentId,
 *   amount normalised to the boundary 2dp string.
 * - `PAYMENT.CAPTURE.DENIED` → `payment.failed` (booking stays PENDING).
 * - `PAYMENT.CAPTURE.REFUNDED` → `other`: refunds originate from OUR admin/auto
 *   flows which already ledger them (Nexora likewise never consumed its own
 *   refund echo); recorded in PaymentEvent for forensics only.
 * - anything else (incl. `CHECKOUT.ORDER.APPROVED`, see class note) → `other`.
 */
function mapPayPalEvent(event: PayPalEventShape): VerifiedEvent {
  if (typeof event.id !== 'string' || typeof event.event_type !== 'string') {
    throw new Error('PayPal webhook payload has no event id/type');
  }
  const resource = event.resource ?? {};
  const money =
    resource.amount?.value && resource.amount.currency_code
      ? {
          // Boundary convention: VerifiedEvent.amount is ALWAYS a 2dp string
          // (PayPal reports "500000" for VND → "500000.00").
          amount: new Prisma.Decimal(resource.amount.value).toFixed(2),
          currency: resource.amount.currency_code.toUpperCase(),
        }
      : {};

  const base = { eventId: event.id, raw: event };
  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      return {
        ...base,
        type: 'payment.completed',
        ...(resource.custom_id ? { bookingId: resource.custom_id } : {}),
        ...(resource.id ? { providerPaymentId: resource.id } : {}),
        ...money,
      };
    case 'PAYMENT.CAPTURE.DENIED':
      return {
        ...base,
        type: 'payment.failed',
        ...(resource.custom_id ? { bookingId: resource.custom_id } : {}),
        ...(resource.id ? { providerPaymentId: resource.id } : {}),
      };
    default:
      return { ...base, type: 'other' };
  }
}

/**
 * Best-effort extraction mã lỗi PayPal từ body lỗi (JSON hoặc text thô).
 *
 * Ưu tiên `details[0].issue` TRƯỚC `message`/`name`: body 422 THẬT của PayPal
 * có dạng `{ name: 'UNPROCESSABLE_ENTITY', message: '<boilerplate không đổi
 * theo nguyên nhân>', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] }` — mã
 * máy-đọc-được (ORDER_ALREADY_CAPTURED, INSTRUMENT_DECLINED, ...) nằm ở
 * details[].issue, còn `message` top-level chỉ là câu boilerplate cố định.
 * Nếu ưu tiên `message` như cũ, `followUp` không bao giờ khớp được chuỗi
 * ORDER_ALREADY_CAPTURED trong nhánh nuốt lỗi idempotent → webhook 422 hợp lệ
 * bị coi là lỗi thật, ném ra và khiến PayPal retry vô hạn (500-loop).
 * Hàm này còn phục vụ log lỗi của refund/verify: ưu tiên issue-first làm log
 * GIÀU thông tin hơn (mã cụ thể thay vì câu boilerplate chung chung).
 */
function paypalErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      message?: string;
      name?: string;
      details?: Array<{ issue?: string }>;
    };
    return parsed.details?.[0]?.issue ?? parsed.message ?? parsed.name ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}
