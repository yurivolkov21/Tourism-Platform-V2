import type { PaymentProvider } from '../../generated/prisma/enums.js';

/**
 * PaymentGateway — nâng cấp đáng chú ý nhất của audit so với money-path của
 * Nexora: Nexora rẽ nhánh theo `PaymentProvider` ngay trong BookingsService
 * (`if STRIPE … else PAYPAL …`, mỗi provider một call-site hình dạng SDK). v2
 * đảo ngược lại: MỘT interface duy nhất, các impl provider nằm sau nó, caller
 * resolve theo `paymentProvider` của booking và không bao giờ thấy kiểu SDK.
 * W1 giao interface + FakeGateway (test instrument cho W2/W3); W5 thêm
 * StripeGateway / PayPalGateway (test/sandbox mode) sau CÙNG một token.
 *
 * Tiền băng qua ranh giới này dưới dạng CHUỖI decimal 2 chữ số thập phân
 * ("117.00") — mỗi impl tự lo phần chuyển đổi minor-unit/format của provider
 * mình (logic money.ts của Nexora dời vào trong các gateway ở W5).
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider;

  /** Tạo hosted checkout session cho một booking PENDING. */
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;

  /**
   * Verify một webhook delivery dựa trên RAW request bytes (parse JSON trước sẽ
   * làm hỏng signature) rồi map nó về {@link VerifiedEvent} provider-neutral.
   * THROW khi signature sai/thiếu — webhook controller map cái đó thành 400
   * (không bao giờ 500: provider sẽ retry mãi mãi).
   */
  verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<VerifiedEvent>;

  /** Phát hành một khoản refund (có thể một phần) trên payment đã capture. */
  refund(input: RefundInput): Promise<{ providerRefundId: string }>;

  /**
   * Hook OPTIONAL: side-effect riêng của provider chạy SAU khi event đã được
   * verify VÀ log (PaymentEvent đã ghi, `handleEvent` đã chạy xong) — ví dụ
   * PayPal cần tự capture order khi nhận CHECKOUT.ORDER.APPROVED (W2 spec
   * ADR-0002, Task 2 dùng member này). Gateway không cần followUp thì bỏ
   * qua member (đa số impl, kể cả Stripe — capture đã xảy ra ở phía Stripe).
   * THROW ở đây cố ý lan ra ngoài route handler thành 500 — báo hiệu provider
   * retry delivery này (không giống verifyWebhook: PaymentEvent audit row đã
   * ghi xong nên retry không mất dữ liệu, chỉ chạy lại followUp).
   */
  followUp?(event: VerifiedEvent): Promise<void>;
}

export interface CreateCheckoutSessionInput {
  bookingId: string;
  /** Booking code người đọc được (`BK-…`) — đưa vào metadata/receipt của provider. */
  code: string;
  /** Chuỗi decimal 2 chữ số thập phân, ví dụ "117.00". */
  amount: string;
  /** ISO-4217, ví dụ "USD". */
  currency: string;
  /** Mô tả line-item hiển thị trên trang checkout của provider. */
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Session id của provider — lưu vào `Booking.providerSessionId`. */
  sessionId: string;
  /** URL redirect đến hosted checkout, trả về cho client. */
  checkoutUrl: string;
}

export interface RefundInput {
  /** Handle của payment đã capture (`Booking.providerPaymentId`). */
  providerPaymentId: string;
  /** Chuỗi decimal 2 chữ số thập phân — hỗ trợ refund một phần (Refund ledger, W3). */
  amount: string;
  currency: string;
  /**
   * Key deterministic do caller cung cấp, các gateway thật forward nó thành
   * header idempotency của provider (`Idempotency-Key` / `PayPal-Request-Id`)
   * để một crash-retry của cùng một lượt refund không bao giờ double-refund
   * (W4 flag). Key theo từng flow: admin `refund:<bookingId>:<alreadyRefundedTotal>`
   * (tổng ledger xác định TRẠNG THÁI LƯỢT THỬ — id của Refund row chưa tồn tại
   * trước khi gọi provider), approve `cancel-refund:<requestId>`, auto
   * `orphan-refund:<bookingId>` / `overbook-refund:<bookingId>`.
   */
  idempotencyKey?: string;
}

/**
 * Webhook event đã verify, provider-neutral. `type` gom cả rừng event của mỗi
 * provider về đúng thứ money-path dispatch trên đó; mọi thứ khác đi kèm trong
 * `raw` cho PaymentEvent log. Các field optional có thể vắng ở event `other`
 * hoặc payload malformed-nhưng-đã-ký — handler (W2) coi việc vắng là
 * "log, skip".
 */
export interface VerifiedEvent {
  /** Event id của provider — nửa của idempotency key (`PaymentEvent @@unique([provider, eventId])`). */
  eventId: string;
  type: 'payment.completed' | 'payment.failed' | 'payment.expired' | 'other';
  bookingId?: string;
  /** Handle của payment đã capture (cần về sau để refund). */
  providerPaymentId?: string;
  /** Chuỗi decimal 2 chữ số thập phân như provider báo về (forensics audit H4). */
  amount?: string;
  currency?: string;
  /** Payload đầy đủ của provider — lưu vào `PaymentEvent.payload`. */
  raw: unknown;
}

/**
 * DI token: `PaymentGateway[]` (mỗi provider được cấu hình một cái). Resolve
 * bằng {@link resolveGateway}. Interface không tồn tại ở runtime, nên dùng Symbol.
 */
export const PAYMENT_GATEWAYS = Symbol('PAYMENT_GATEWAYS');

/**
 * Giá trị đầu tiên của một header webhook đến (có thể đa giá trị) — Fastify
 * lowercase tên header, nên tra bằng dạng lowercase. Dùng chung bởi các bản
 * `verifyWebhook` của gateway thật.
 */
export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Chọn gateway theo provider của booking; throw nếu provider đó chưa được cấu hình. */
export function resolveGateway(
  gateways: readonly PaymentGateway[],
  provider: PaymentProvider,
): PaymentGateway {
  const gateway = gateways.find((candidate) => candidate.provider === provider);
  if (!gateway) {
    throw new Error(`No PaymentGateway configured for provider ${provider}`);
  }
  return gateway;
}
