import { PaymentProvider } from '../../generated/prisma/enums.js';
import type {
  CheckoutSession,
  CreateCheckoutSessionInput,
  PaymentGateway,
  RefundInput,
  VerifiedEvent,
} from './gateway.js';

/** Header signature webhook mà FakeGateway verify (xem {@link FakeGateway.verifyWebhook}). */
export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';
/** Giá trị signature duy nhất mà FakeGateway chấp nhận. */
export const FAKE_VALID_SIGNATURE = 'fake-valid';

/** Thứ mà fake nhớ về một checkout session đã tạo. */
export interface FakeCheckoutSession extends CheckoutSession {
  input: CreateCheckoutSessionInput;
}

/**
 * PaymentGateway in-memory, deterministic — CHÍNH là test instrument cho
 * money-path (spec P2 §4: FakeGateway mô phỏng webhook duplicate, out-of-order
 * và orphaned; int test W2/W3 điều khiển nó).
 *
 * Đăng ký: export từ PaymentsModule nhưng chỉ được PROVIDE khi `NODE_ENV=test`
 * (conditional provider trong payments.module.ts — DI ở prod không bao giờ
 * thấy nó; W5 đăng ký các gateway thật cho các env khác). Int test lấy instance
 * bằng `app.get(FakeGateway)`.
 *
 * Tính deterministic: id sinh từ một counter đơn điệu (`fake_cs_1`,
 * `fake_evt_2`, …), không bao giờ từ randomness hay clock — assertion có thể
 * ghim chính xác giá trị.
 *
 * Mô phỏng webhook: `emitPaymentCompleted()` trả về một {@link VerifiedEvent}
 * tổng hợp; POST JSON của nó kèm header `x-fake-signature: fake-valid` và
 * `verifyWebhook` sẽ round-trip nó.
 * - Delivery DUPLICATE: truyền lại cùng `eventId` (`opts.eventId`).
 * - Capture ORPHANED / MUỘN: emit cho một booking đã bị cancelled — fake không
 *   biết cũng không quan tâm trạng thái booking.
 */
export class FakeGateway implements PaymentGateway {
  readonly sessions: FakeCheckoutSession[] = [];
  readonly refunds: Array<RefundInput & { providerRefundId: string }> = [];
  /** Ghi lại mọi event mà controller đã gọi `followUp` (W1 nền cho Task 2). */
  readonly followUpCalls: VerifiedEvent[] = [];

  private seq = 0;

  /**
   * Test toggle (không thuộc PaymentGateway): bật để `refund()` NÉM lỗi, mô phỏng
   * provider từ chối/timeout. Dùng để canh nhánh refund-thất-bại (W3): service
   * phải ném `ProviderRefundFailedError` (→ 502) và KHÔNG ghi ledger nào. Reset
   * về false trong `reset()`.
   */
  failRefunds = false;

  /**
   * Test toggle: bật để `createCheckoutSession` NÉM lỗi, mô phỏng gateway lỗi/
   * rate-limit đúng lúc create (BK-1). Service phải ném `CheckoutFailedError`
   * (→ 502 `CHECKOUT_FAILED`) và để booking ở lại PENDING không session. Reset
   * về false trong `reset()`.
   */
  failCheckout = false;

  /**
   * Test toggle: trễ nhân tạo (ms) trong `refund()` — dùng để ÉP race concurrent
   * (hai refund cùng đọc ledger trước khi bên nào ghi), canh advisory lock BK-R1.
   * Reset về 0 trong `reset()`.
   */
  refundDelayMs = 0;

  /**
   * Test toggle: đặt để `followUp` NÉM lỗi này, mô phỏng side-effect
   * follow-up thất bại (vd PayPal capture lỗi ở Task 2) — canh nhánh
   * throw-lan-ra-500 của webhook controller. Reset về undefined trong
   * `reset()`.
   */
  followUpError?: Error;

  constructor(readonly provider: PaymentProvider = PaymentProvider.STRIPE) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    if (this.failCheckout) {
      throw new Error('FakeGateway: forced checkout failure');
    }
    const sessionId = `fake_cs_${++this.seq}`;
    const session: FakeCheckoutSession = {
      sessionId,
      checkoutUrl: `https://checkout.fake.local/pay/${sessionId}`,
      input,
    };
    this.sessions.push(session);
    return { sessionId: session.sessionId, checkoutUrl: session.checkoutUrl };
  }

  /**
   * Chỉ chấp nhận đúng `x-fake-signature: fake-valid` và một JSON body có hình
   * dạng như {@link VerifiedEvent} (thứ các helper emit trả về). Throw với mọi
   * thứ khác — soi gương đúng hợp đồng throw-on-bad-signature của gateway thật.
   */
  async verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<VerifiedEvent> {
    const signature = headers[FAKE_SIGNATURE_HEADER];
    if (signature !== FAKE_VALID_SIGNATURE) {
      throw new Error('FakeGateway: invalid webhook signature');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    } catch {
      throw new Error('FakeGateway: webhook body is not JSON');
    }
    const event = parsed as Partial<VerifiedEvent>;
    if (typeof event.eventId !== 'string' || typeof event.type !== 'string') {
      throw new Error('FakeGateway: webhook body is not a VerifiedEvent');
    }
    return { ...(event as VerifiedEvent), raw: parsed };
  }

  /** Ghi lại toàn bộ {@link RefundInput} — BAO GỒM `idempotencyKey` phía
   * provider mà caller truyền (W5), để int test có thể assert key mỗi flow gửi. */
  async refund(input: RefundInput): Promise<{ providerRefundId: string }> {
    // Mô phỏng provider từ chối refund (xem {@link failRefunds}) — ném TRƯỚC khi
    // ghi gì, đúng như gateway thật khi HTTP refund lỗi.
    if (this.failRefunds) {
      throw new Error('FakeGateway: forced refund failure');
    }
    if (this.refundDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.refundDelayMs));
    }
    const providerRefundId = `fake_re_${++this.seq}`;
    this.refunds.push({ ...input, providerRefundId });
    return { providerRefundId };
  }

  /**
   * Ghi lại event nhận được (kể cả khi sắp throw — controller phải thấy được
   * followUp ĐÃ chạy dù kết quả là lỗi). Ném {@link followUpError} nếu được
   * đặt, mô phỏng provider follow-up thất bại.
   */
  async followUp(event: VerifiedEvent): Promise<void> {
    this.followUpCalls.push(event);
    if (this.followUpError) {
      throw this.followUpError;
    }
  }

  // ── Test helper (không thuộc PaymentGateway) ─────────────────────────────

  /**
   * Tổng hợp một event `payment.completed` cho một booking. Amount/currency/
   * payment id mặc định lấy từ checkout session đã ghi của booking nếu có; mỗi
   * lời gọi tạo một `eventId` mới trừ khi `opts.eventId` ghim sẵn một cái (đó
   * là cách mô phỏng một provider retry DUPLICATE).
   */
  emitPaymentCompleted(bookingId: string, opts: FakeEmitOptions = {}): VerifiedEvent {
    return this.emit('payment.completed', bookingId, opts);
  }

  /** Event `payment.failed` tổng hợp — cùng quy tắc mặc định như completed. */
  emitPaymentFailed(bookingId: string, opts: FakeEmitOptions = {}): VerifiedEvent {
    return this.emit('payment.failed', bookingId, opts);
  }

  /** Event `payment.expired` (PAY-1) — checkout session hết hạn trên PENDING. */
  emitCheckoutExpired(bookingId: string, opts: FakeEmitOptions = {}): VerifiedEvent {
    return this.emit('payment.expired', bookingId, opts);
  }

  /** Checkout session được ghi gần nhất cho một booking, nếu có. */
  sessionFor(bookingId: string): FakeCheckoutSession | undefined {
    return [...this.sessions].reverse().find((s) => s.input.bookingId === bookingId);
  }

  /** Xóa toàn bộ state đã ghi và id counter (gọi trong beforeEach). */
  reset(): void {
    this.sessions.length = 0;
    this.refunds.length = 0;
    this.followUpCalls.length = 0;
    this.seq = 0;
    this.failRefunds = false;
    this.refundDelayMs = 0;
    this.failCheckout = false;
    this.followUpError = undefined;
  }

  private emit(
    type: 'payment.completed' | 'payment.failed' | 'payment.expired',
    bookingId: string,
    opts: FakeEmitOptions,
  ): VerifiedEvent {
    const session = this.sessionFor(bookingId);
    const event: VerifiedEvent = {
      eventId: opts.eventId ?? `fake_evt_${++this.seq}`,
      type,
      bookingId,
      providerPaymentId: opts.providerPaymentId ?? `fake_pay_${bookingId}`,
      amount: opts.amount ?? session?.input.amount,
      currency: opts.currency ?? session?.input.currency,
      raw: { fake: true, sessionId: session?.sessionId ?? null },
    };
    return event;
  }
}

export interface FakeEmitOptions {
  /** Ghim event id để replay CÙNG một event (webhook delivery duplicate). */
  eventId?: string;
  providerPaymentId?: string;
  /** Chuỗi decimal 2 chữ số thập phân; mặc định lấy amount của session đã ghi. */
  amount?: string;
  currency?: string;
}
