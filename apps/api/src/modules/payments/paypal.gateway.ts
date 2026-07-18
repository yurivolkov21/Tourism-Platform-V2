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

/** Sandbox only for the capstone (no revenue — spec §1); tests may override. */
const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';
/** Refresh the cached OAuth token this long before its stated expiry. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export interface PayPalGatewayOptions {
  clientId: string;
  clientSecret: string;
  /** Webhook id from the PayPal app config — REQUIRED for verification. */
  webhookId: string;
  /** Override for tests; defaults to the sandbox API host. */
  baseUrl?: string;
}

/**
 * PayPal (Orders v2, sandbox) implementation of {@link PaymentGateway} — port
 * of Nexora's PayPalService SHAPE without `@paypal/paypal-server-sdk`: Nexora
 * used the SDK for orders/refunds but ALREADY spoke raw HTTP (fetch + cached
 * client-credentials token) for OAuth and webhook verification; v2 does the
 * remaining two endpoints raw as well, through the injectable {@link HttpPost}
 * seam so every call is unit-testable offline (D2: no network smoke in P2).
 *
 * Webhook verification is PayPal's `verify-webhook-signature` API (unlike
 * Stripe there is no offline HMAC scheme for REST webhooks) — a network call
 * in production, a stubbed `httpPost` in tests. `custom_id` on the purchase
 * unit is the bookingId bridge (Nexora-proven), the capture id becomes
 * `providerPaymentId` (the refund handle).
 *
 * NOTE capture trigger: Nexora captured on buyer return (`captureOrder` from
 * the return endpoint) with the webhook as backstop. The P2 interface has no
 * capture surface — the return-page capture lands with the web checkout flow
 * (P3); until then `CHECKOUT.ORDER.APPROVED` maps to `other` (recorded only).
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

  // ── Internals ─────────────────────────────────────────────────────────────

  /** JSON POST with Bearer auth; `PayPal-Request-Id` = provider idempotency. */
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
    const json = JSON.parse(response.body) as { access_token: string; expires_in: number };
    this.cachedToken = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
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

/** Best-effort extraction of PayPal's error `message`/`name` from a failure body. */
function paypalErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; name?: string };
    return parsed.message ?? parsed.name ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}
