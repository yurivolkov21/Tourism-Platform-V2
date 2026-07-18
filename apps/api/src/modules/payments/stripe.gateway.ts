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

/** Stripe's documented webhook timestamp tolerance (replay window), seconds. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
/** Explicit Checkout Session expiry — abandoned sessions fire `checkout.session.expired`. */
const SESSION_EXPIRY_SECONDS = 30 * 60;

const API_BASE = 'https://api.stripe.com';

export interface StripeGatewayOptions {
  secretKey: string;
  webhookSecret: string;
}

/**
 * Stripe implementation of {@link PaymentGateway} (spec P2 §3 W5, test mode).
 *
 * Nexora wrapped the `stripe` npm SDK (StripeService); v2 talks to the three
 * endpoints the money-path needs over raw HTTPS instead — the SDK would be a
 * whole dependency for two form-encoded POSTs plus an HMAC we must be able to
 * unit-test offline anyway (D2: no network smoke in P2). The PROVEN pieces are
 * ported 1:1: Checkout Session field set incl. the 30-min `expires_at` and
 * `metadata.bookingId` bridge, refund-by-payment_intent with an idempotency
 * key, and verify-then-map webhook handling.
 *
 * Webhook verification implements Stripe's documented scheme by hand: header
 * `Stripe-Signature: t=<unix>,v1=<hex hmac>` where the HMAC-SHA256 of
 * `"<t>.<raw body>"` is keyed with the endpoint's webhook secret; constant-time
 * compare, ±5-min tolerance on `t`. THROWS on any failure — the webhooks
 * controller maps that to 400.
 */
export class StripeGateway implements PaymentGateway {
  readonly provider = PaymentProvider.STRIPE;
  private readonly logger = new Logger(StripeGateway.name);

  constructor(
    private readonly options: StripeGatewayOptions,
    private readonly httpPost: HttpPost = defaultHttpPost,
  ) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
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
      expires_at: String(Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS),
    });

    const session = await this.post<{ id: string; url: string | null }>(
      '/v1/checkout/sessions',
      params,
    );
    if (!session.url) {
      throw new Error(`Stripe Checkout session ${session.id} has no redirect url`);
    }
    this.logger.log(`Created Stripe Checkout session ${session.id} for booking ${input.code}`);
    return { sessionId: session.id, checkoutUrl: session.url };
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

  /** Form-encoded POST with Bearer auth; non-2xx → throw the Stripe error message. */
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
   * Stripe-Signature scheme (`t=`,`v1=`): HMAC-SHA256(`"<t>.<payload>"`,
   * webhookSecret) must constant-time-equal one of the `v1` candidates and `t`
   * must sit within the 5-min tolerance (replay window).
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

/** Fields we read off a verified Stripe event (everything else rides in `raw`). */
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
 * Verified Stripe event → provider-neutral {@link VerifiedEvent} (Nexora's
 * PaymentsService dispatch mapping, moved inside the gateway):
 * - `checkout.session.completed` → `payment.completed` — bookingId from the
 *   session metadata we minted, providerPaymentId = `payment_intent` (the
 *   canonical refund handle), amount/currency from `amount_total`.
 * - `checkout.session.expired` / `payment_intent.payment_failed` →
 *   `payment.failed` (a PaymentIntent carries no session metadata, so
 *   bookingId may be absent — handler logs and skips).
 * - anything else → `other` (recorded, ignored).
 */
function mapStripeEvent(event: StripeEventShape): VerifiedEvent {
  if (typeof event.id !== 'string' || typeof event.type !== 'string') {
    throw new Error('Stripe webhook payload has no event id/type');
  }
  const object = event.data?.object ?? {};
  const bookingId = object.metadata?.bookingId;
  const currency = object.currency ? object.currency.toUpperCase() : undefined;

  const base = { eventId: event.id, raw: event } satisfies Partial<VerifiedEvent> & {
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
    case 'payment_intent.payment_failed':
      return { ...base, type: 'payment.failed', ...(bookingId ? { bookingId } : {}) };
    default:
      return { ...base, type: 'other' };
  }
}

/** Best-effort extraction of Stripe's `error.message` from a failure body. */
function stripeErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}
