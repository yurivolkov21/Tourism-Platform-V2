import { PaymentProvider } from '../../generated/prisma/enums.js';
import type {
  CheckoutSession,
  CreateCheckoutSessionInput,
  PaymentGateway,
  RefundInput,
  VerifiedEvent,
} from './gateway.js';

/** Webhook signature header the FakeGateway verifies (see {@link FakeGateway.verifyWebhook}). */
export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';
/** The only signature value the FakeGateway accepts. */
export const FAKE_VALID_SIGNATURE = 'fake-valid';

/** What the fake remembers about a minted checkout session. */
export interface FakeCheckoutSession extends CheckoutSession {
  input: CreateCheckoutSessionInput;
}

/**
 * In-memory, deterministic PaymentGateway — THE test instrument for the
 * money-path (spec P2 §4: FakeGateway simulates duplicate, out-of-order and
 * orphaned webhooks; W2/W3 int tests drive it).
 *
 * Registration: exported from PaymentsModule but only PROVIDED under
 * `NODE_ENV=test` (conditional provider in payments.module.ts — prod DI never
 * sees it; W5 registers the real gateways for the other envs). Int tests grab
 * the instance with `app.get(FakeGateway)`.
 *
 * Determinism: ids come from a monotonic counter (`fake_cs_1`, `fake_evt_2`,
 * …), never from randomness or clocks — assertions can pin exact values.
 *
 * Webhook simulation: `emitPaymentCompleted()` returns a synthetic
 * {@link VerifiedEvent}; POST its JSON with header
 * `x-fake-signature: fake-valid` and `verifyWebhook` round-trips it.
 * - DUPLICATE delivery: pass the same `eventId` again (`opts.eventId`).
 * - ORPHANED / LATE capture: emit for a booking that was already cancelled —
 *   the fake neither knows nor cares about booking state.
 */
export class FakeGateway implements PaymentGateway {
  readonly sessions: FakeCheckoutSession[] = [];
  readonly refunds: Array<RefundInput & { providerRefundId: string }> = [];

  private seq = 0;

  constructor(readonly provider: PaymentProvider = PaymentProvider.STRIPE) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
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
   * Accepts exactly `x-fake-signature: fake-valid` and a JSON body shaped like
   * a {@link VerifiedEvent} (what the emit helpers return). Throws on anything
   * else — mirroring the real gateways' throw-on-bad-signature contract.
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

  /** Records the full {@link RefundInput} — INCLUDING the caller's provider
   * `idempotencyKey` (W5), so int tests can assert the key each flow passes. */
  async refund(input: RefundInput): Promise<{ providerRefundId: string }> {
    const providerRefundId = `fake_re_${++this.seq}`;
    this.refunds.push({ ...input, providerRefundId });
    return { providerRefundId };
  }

  // ── Test helpers (not part of PaymentGateway) ─────────────────────────────

  /**
   * Synthesizes a `payment.completed` event for a booking. Amount/currency/
   * payment id default from the booking's recorded checkout session when one
   * exists; every call mints a fresh `eventId` unless `opts.eventId` pins one
   * (that is how a DUPLICATE provider retry is simulated).
   */
  emitPaymentCompleted(bookingId: string, opts: FakeEmitOptions = {}): VerifiedEvent {
    return this.emit('payment.completed', bookingId, opts);
  }

  /** Synthetic `payment.failed` event — same defaulting rules as completed. */
  emitPaymentFailed(bookingId: string, opts: FakeEmitOptions = {}): VerifiedEvent {
    return this.emit('payment.failed', bookingId, opts);
  }

  /** Last recorded checkout session for a booking, if any. */
  sessionFor(bookingId: string): FakeCheckoutSession | undefined {
    return [...this.sessions].reverse().find((s) => s.input.bookingId === bookingId);
  }

  /** Clears all recorded state and the id counter (call in beforeEach). */
  reset(): void {
    this.sessions.length = 0;
    this.refunds.length = 0;
    this.seq = 0;
  }

  private emit(
    type: 'payment.completed' | 'payment.failed',
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
  /** Pin the event id to replay the SAME event (duplicate webhook delivery). */
  eventId?: string;
  providerPaymentId?: string;
  /** 2dp decimal string; defaults to the recorded session amount. */
  amount?: string;
  currency?: string;
}
