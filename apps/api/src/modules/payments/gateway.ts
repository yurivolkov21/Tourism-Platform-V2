import type { PaymentProvider } from '../../generated/prisma/enums.js';

/**
 * PaymentGateway — the audit's headline upgrade over Nexora's money-path:
 * Nexora branched on `PaymentProvider` inside BookingsService (`if STRIPE …
 * else PAYPAL …`, one SDK-shaped call-site per provider). v2 inverts that:
 * ONE interface, provider impls behind it, callers resolve by the booking's
 * `paymentProvider` and never see an SDK type. W1 ships the interface +
 * FakeGateway (the test instrument for W2/W3); W5 adds StripeGateway /
 * PayPalGateway (test/sandbox mode) behind the SAME token.
 *
 * Money crosses this boundary as 2dp decimal STRINGS ("117.00") — each impl
 * owns its provider's minor-unit/format conversion (Nexora money.ts logic
 * moves inside the gateways in W5).
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider;

  /** Mints a hosted checkout session for a PENDING booking. */
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;

  /**
   * Verifies a webhook delivery against the RAW request bytes (JSON-parsing
   * first corrupts the signature) and maps it onto the provider-neutral
   * {@link VerifiedEvent}. THROWS on a bad/missing signature — the webhook
   * controller maps that to 400 (never 500: the provider would retry forever).
   */
  verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<VerifiedEvent>;

  /** Issues a (partial) refund against a captured payment. */
  refund(input: RefundInput): Promise<{ providerRefundId: string }>;
}

export interface CreateCheckoutSessionInput {
  bookingId: string;
  /** Human-readable booking code (`BK-…`) — lands in provider metadata/receipts. */
  code: string;
  /** 2dp decimal string, e.g. "117.00". */
  amount: string;
  /** ISO-4217, e.g. "USD". */
  currency: string;
  /** Line-item description shown on the provider's checkout page. */
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Provider session id — persisted as `Booking.providerSessionId`. */
  sessionId: string;
  /** Hosted checkout redirect URL returned to the client. */
  checkoutUrl: string;
}

export interface RefundInput {
  /** Captured payment handle (`Booking.providerPaymentId`). */
  providerPaymentId: string;
  /** 2dp decimal string — supports partial refunds (Refund ledger, W3). */
  amount: string;
  currency: string;
}

/**
 * Provider-neutral verified webhook event. `type` collapses each provider's
 * event zoo into what the money-path dispatches on; everything else rides in
 * `raw` for the PaymentEvent log. Optional fields may be missing on `other`
 * events or malformed-but-signed payloads — the handler (W2) treats absence
 * as "log, skip".
 */
export interface VerifiedEvent {
  /** Provider event id — idempotency key half (`PaymentEvent @@unique([provider, eventId])`). */
  eventId: string;
  type: 'payment.completed' | 'payment.failed' | 'other';
  bookingId?: string;
  /** Captured payment handle (needed later for refunds). */
  providerPaymentId?: string;
  /** 2dp decimal string as reported by the provider (audit H4 forensics). */
  amount?: string;
  currency?: string;
  /** Full provider payload — persisted as `PaymentEvent.payload`. */
  raw: unknown;
}

/**
 * DI token: `PaymentGateway[]` (one per configured provider). Resolve with
 * {@link resolveGateway}. Interfaces don't exist at runtime, hence a Symbol.
 */
export const PAYMENT_GATEWAYS = Symbol('PAYMENT_GATEWAYS');

/** Picks the gateway for a booking's provider; throws if it isn't configured. */
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
