import { createHmac, timingSafeEqual } from 'node:crypto';
import { Logger } from '@nestjs/common';
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
import { fromMinorUnits, toMinorUnits } from './money.js';

/** Tolerance timestamp webhook theo tài liệu Stripe (cửa sổ replay), tính giây. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
/**
 * Hạn Checkout Session tường minh — session bị bỏ dở sẽ bắn `checkout.session.expired`.
 * 60 phút, KHÔNG phải 30 phút: floor của Stripe là 30 phút nhưng tính THEO
 * ĐỒNG HỒ CỦA STRIPE, không phải đồng hồ máy gọi. Đặt sát floor (30') từng bị
 * Stripe từ chối `expires_at timestamp must be at least 30 minutes from
 * Checkout Session creation` — đo được clock skew −86s giữa máy gọi và
 * Stripe/Google/PayPal trong smoke sandbox 04/08, đủ để rơi dưới floor. Mọi
 * máy đều có thể lệch vài chục giây; 60 phút chừa lề 30 phút an toàn.
 */
export const SESSION_EXPIRY_SECONDS = 60 * 60;

const API_BASE = 'https://api.stripe.com';

export interface StripeGatewayOptions {
  secretKey: string;
  webhookSecret: string;
}

/**
 * Bản triển khai {@link PaymentGateway} cho Stripe (spec P2 §3 W5, test mode).
 *
 * Nexora bọc SDK npm `stripe` (StripeService); v2 nói chuyện raw HTTPS với
 * đúng ba endpoint mà money-path cần — kéo nguyên SDK về chỉ để làm hai POST
 * form-encoded cộng một HMAC mà đằng nào ta cũng phải tự unit-test offline
 * (D2: P2 không smoke qua mạng) là không đáng. Các mảnh ĐÃ ĐƯỢC KIỂM CHỨNG
 * port 1:1: bộ field Checkout Session gồm `expires_at` tường minh và cầu nối
 * `metadata.bookingId`, refund theo payment_intent kèm idempotency key, và
 * lối xử lý webhook verify-rồi-map.
 *
 * Phần verify webhook tự cài theo đúng scheme Stripe công bố: header
 * `Stripe-Signature: t=<unix>,v1=<hex hmac>`, trong đó HMAC-SHA256 của
 * `"<t>.<raw body>"` ký bằng webhook secret của endpoint; so sánh
 * constant-time, tolerance ±5 phút cho `t`. THROW ở mọi thất bại — controller
 * webhook map cái đó thành 400.
 */
export class StripeGateway implements PaymentGateway {
  readonly provider = PaymentProvider.STRIPE;
  private readonly logger = new Logger(StripeGateway.name);

  constructor(
    private readonly options: StripeGatewayOptions,
    private readonly httpPost: HttpPost = defaultHttpPost,
  ) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    // Hạn tính MỘT lần rồi dùng cho cả provider lẫn `expiresAt` trả về — hai
    // bên không được lệch nhau (reCheckout so hạn này để quyết mint hay không).
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000);
    const params = new URLSearchParams({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(toMinorUnits(input.amount, input.currency)),
      'line_items[0][price_data][product_data][name]': input.description,
      'metadata[bookingId]': input.bookingId,
      'metadata[bookingCode]': input.code,
      expires_at: String(Math.floor(expiresAt.getTime() / 1000)),
    });

    const session = await this.post<{ id: string; url: string | null }>(
      '/v1/checkout/sessions',
      params,
    );
    if (!session.url) {
      throw new Error(`Stripe Checkout session ${session.id} has no redirect url`);
    }
    this.logger.log(`Created Stripe Checkout session ${session.id} for booking ${input.code}`);
    return { sessionId: session.id, checkoutUrl: session.url, expiresAt };
  }

  /**
   * ADR-0006 AMEND 1a: vô hiệu session cũ TRƯỚC khi mint session mới — chặn
   * hai session cùng sống. Stripe chỉ expire được session `status=open`;
   * session đã expired/completed thì API trả lỗi — caller coi là best-effort.
   */
  async expireSession(sessionId: string): Promise<void> {
    await this.post(`/v1/checkout/sessions/${sessionId}/expire`, new URLSearchParams());
    this.logger.log(`Expired Stripe Checkout session ${sessionId}`);
  }

  async verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<VerifiedEvent> {
    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    this.verifySignature(payload, headerValue(headers, 'stripe-signature'));
    return mapStripeEvent(JSON.parse(payload));
  }

  async refund(input: RefundInput): Promise<{ providerRefundId: string }> {
    const params = new URLSearchParams({
      payment_intent: input.providerPaymentId,
      amount: String(toMinorUnits(input.amount, input.currency)),
    });
    const refund = await this.post<{ id: string; status: string | null }>(
      '/v1/refunds',
      params,
      input.idempotencyKey,
    );
    this.logger.log(
      `Issued Stripe refund ${refund.id} for payment_intent ${input.providerPaymentId} (status=${refund.status})`,
    );
    return { providerRefundId: refund.id };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** POST form-encoded kèm Bearer auth; non-2xx → throw kèm message lỗi của Stripe. */
  private async post<T>(
    path: string,
    params: URLSearchParams,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.options.secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    const response = await this.httpPost(`${API_BASE}${path}`, {
      headers,
      body: params.toString(),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Stripe ${path} failed (HTTP ${response.status}): ${stripeErrorMessage(response.body)}`,
      );
    }
    return JSON.parse(response.body) as T;
  }

  /**
   * Scheme Stripe-Signature (`t=`,`v1=`): HMAC-SHA256(`"<t>.<payload>"`,
   * webhookSecret) phải constant-time-equal với một trong các ứng viên `v1`, và
   * `t` phải nằm trong tolerance 5 phút (cửa sổ replay).
   */
  private verifySignature(payload: string, header: string | undefined): void {
    if (!header) throw new Error('missing Stripe-Signature header');
    const parts = header.split(',').map((part) => part.split('=', 2));
    const timestampRaw = parts.find(([key]) => key === 't')?.[1];
    const candidates = parts
      .filter(([key]) => key === 'v1')
      .map(([, value]) => value)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const timestamp = Number(timestampRaw);
    if (!Number.isFinite(timestamp) || candidates.length === 0) {
      throw new Error('malformed Stripe-Signature header');
    }
    if (Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
      throw new Error('Stripe-Signature timestamp outside tolerance');
    }
    const expected = createHmac('sha256', this.options.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest();
    const match = candidates.some((candidate) => {
      const buffer = Buffer.from(candidate, 'hex');
      return buffer.length === expected.length && timingSafeEqual(buffer, expected);
    });
    if (!match) throw new Error('Stripe-Signature verification failed');
  }
}

/** Các field ta đọc từ event Stripe đã verify (phần còn lại nằm trong `raw`). */
interface StripeEventShape {
  id?: string;
  type?: string;
  data?: {
    object?: {
      payment_intent?: string | null;
      amount_total?: number | null;
      currency?: string | null;
      metadata?: Record<string, string | undefined> | null;
    };
  };
}

/**
 * Event Stripe đã verify → {@link VerifiedEvent} trung lập provider (mapping
 * dispatch vốn nằm ở PaymentsService của Nexora, nay dời vào trong gateway):
 * - `checkout.session.completed` → `payment.completed` — bookingId lấy từ
 *   metadata session do ta tự đặt, providerPaymentId = `payment_intent` (handle
 *   chuẩn để refund), amount/currency lấy từ `amount_total`.
 * - `checkout.session.expired` / `payment_intent.payment_failed` →
 *   `payment.failed` (PaymentIntent không mang metadata của session nên
 *   bookingId có thể vắng — handler log-and-skip).
 * - còn lại → `other` (chỉ ghi nhận, bỏ qua).
 */
function mapStripeEvent(event: StripeEventShape): VerifiedEvent {
  if (typeof event.id !== 'string' || typeof event.type !== 'string') {
    throw new Error('Stripe webhook payload has no event id/type');
  }
  const object = event.data?.object ?? {};
  const bookingId = object.metadata?.bookingId;
  const currency = object.currency ? object.currency.toUpperCase() : undefined;

  const base = {
    eventId: event.id,
    raw: event,
  } satisfies Partial<VerifiedEvent> & {
    eventId: string;
    raw: unknown;
  };
  switch (event.type) {
    case 'checkout.session.completed':
      return {
        ...base,
        type: 'payment.completed',
        ...(bookingId ? { bookingId } : {}),
        ...(object.payment_intent ? { providerPaymentId: object.payment_intent } : {}),
        ...(typeof object.amount_total === 'number' && currency
          ? { amount: fromMinorUnits(object.amount_total, currency), currency }
          : {}),
      };
    case 'checkout.session.expired':
      // PAY-1: hết hạn checkout ≠ thanh toán thất bại — tách để hủy PENDING.
      return {
        ...base,
        type: 'payment.expired',
        ...(bookingId ? { bookingId } : {}),
      };
    case 'payment_intent.payment_failed':
      return {
        ...base,
        type: 'payment.failed',
        ...(bookingId ? { bookingId } : {}),
      };
    default:
      return { ...base, type: 'other' };
  }
}

/** Cố gắng rút `error.message` của Stripe từ body lỗi (best-effort). */
function stripeErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}
