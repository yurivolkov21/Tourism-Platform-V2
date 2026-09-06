import { createHmac } from 'node:crypto';
import { PaymentProvider } from '../../generated/prisma/enums.js';
import type { HttpPostCall, HttpPostResponse } from '../../lib/provider-http.js';
import { StripeGateway } from './stripe.gateway.js';

const SECRET_KEY = 'sk_test_unit';
const WEBHOOK_SECRET = 'whsec_unit_test_secret';

/** Crafts a valid Stripe-Signature header — we control both sides offline (D2). */
function sign(body: string, secret: string, timestampSec = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', secret).update(`${timestampSec}.${body}`).digest('hex');
  return `t=${timestampSec},v1=${v1}`;
}

/** httpPost stub: records every call, replies from a FIFO script (default 200 {}). */
function stubHttp(...responses: HttpPostResponse[]) {
  const calls: HttpPostCall[] = [];
  const post = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, ...init });
    return responses.shift() ?? { status: 200, body: '{}' };
  };
  return { calls, post };
}

function makeGateway(...responses: HttpPostResponse[]) {
  const http = stubHttp(...responses);
  const gateway = new StripeGateway(
    { secretKey: SECRET_KEY, webhookSecret: WEBHOOK_SECRET },
    http.post,
  );
  return { gateway, ...http };
}

function completedSessionEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        payment_intent: 'pi_123',
        amount_total: 11700,
        currency: 'usd',
        metadata: { bookingId: 'b-1', bookingCode: 'BK-1' },
        ...overrides,
      },
    },
  };
}

describe('StripeGateway.verifyWebhook', () => {
  it('accepts a validly signed payload and maps checkout.session.completed', async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify(completedSessionEvent());

    const event = await gateway.verifyWebhook(Buffer.from(body), {
      'stripe-signature': sign(body, WEBHOOK_SECRET),
    });

    expect(event).toMatchObject({
      eventId: 'evt_1',
      type: 'payment.completed',
      bookingId: 'b-1',
      providerPaymentId: 'pi_123',
      amount: '117.00',
      currency: 'USD',
      sessionId: 'cs_test_1', // ADR-0006 AMEND 1c — id của checkout session
    });
    expect(event.raw).toEqual(JSON.parse(body));
  });

  it('converts zero-decimal amount_total without scaling (VND)', async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify(completedSessionEvent({ amount_total: 500000, currency: 'vnd' }));
    const event = await gateway.verifyWebhook(body, {
      'stripe-signature': sign(body, WEBHOOK_SECRET),
    });
    expect(event.amount).toBe('500000.00');
    expect(event.currency).toBe('VND');
  });

  it('rejects a tampered body (signature no longer matches)', async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify(completedSessionEvent());
    const header = sign(body, WEBHOOK_SECRET);
    const tampered = body.replace('11700', '1');

    await expect(gateway.verifyWebhook(tampered, { 'stripe-signature': header })).rejects.toThrow(
      /signature/i,
    );
  });

  it('rejects a signature minted with the wrong secret', async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify(completedSessionEvent());
    await expect(
      gateway.verifyWebhook(body, {
        'stripe-signature': sign(body, 'whsec_wrong'),
      }),
    ).rejects.toThrow(/signature/i);
  });

  it('rejects a stale timestamp (outside the 5-minute tolerance)', async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify(completedSessionEvent());
    const stale = Math.floor(Date.now() / 1000) - 6 * 60;
    await expect(
      gateway.verifyWebhook(body, {
        'stripe-signature': sign(body, WEBHOOK_SECRET, stale),
      }),
    ).rejects.toThrow(/tolerance/i);
  });

  it('rejects a missing or malformed header', async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify(completedSessionEvent());
    await expect(gateway.verifyWebhook(body, {})).rejects.toThrow(/signature/i);
    await expect(gateway.verifyWebhook(body, { 'stripe-signature': 'garbage' })).rejects.toThrow(
      /signature/i,
    );
  });

  it('maps checkout.session.expired to payment.expired (PAY-1: tách khỏi failed)', async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify({
      id: 'evt_2',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_1', metadata: { bookingId: 'b-1' } } },
    });
    const event = await gateway.verifyWebhook(body, {
      'stripe-signature': sign(body, WEBHOOK_SECRET),
    });
    expect(event).toMatchObject({
      eventId: 'evt_2',
      type: 'payment.expired',
      bookingId: 'b-1',
      sessionId: 'cs_test_1', // AMEND 1c: expired chỉ được huỷ ĐÚNG session này
    });
  });

  it('maps payment_intent.payment_failed to payment.failed (bookingId optional)', async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify({
      id: 'evt_3',
      type: 'payment_intent.payment_failed',
      data: {
        object: { id: 'pi_123', object: 'payment_intent', metadata: {} },
      },
    });
    const event = await gateway.verifyWebhook(body, {
      'stripe-signature': sign(body, WEBHOOK_SECRET),
    });
    expect(event.type).toBe('payment.failed');
    expect(event.bookingId).toBeUndefined();
    // data.object ở đây là PaymentIntent — id của nó KHÔNG phải session id.
    expect(event.sessionId).toBeUndefined();
  });

  it("maps anything else to 'other'", async () => {
    const { gateway } = makeGateway();
    const body = JSON.stringify({
      id: 'evt_4',
      type: 'charge.updated',
      data: { object: {} },
    });
    const event = await gateway.verifyWebhook(body, {
      'stripe-signature': sign(body, WEBHOOK_SECRET),
    });
    expect(event).toMatchObject({ eventId: 'evt_4', type: 'other' });
  });
});

describe('StripeGateway.createCheckoutSession', () => {
  const input = {
    bookingId: 'b-1',
    code: 'BK-1',
    amount: '117.00',
    currency: 'USD',
    description: 'Tour: Ha Long Bay',
    successUrl: 'http://localhost:3000/checkout/success?code=BK-1',
    cancelUrl: 'http://localhost:3000/checkout/cancel?code=BK-1',
  };

  it('POSTs a form-encoded Checkout Session with minor units + metadata', async () => {
    const { gateway, calls } = makeGateway({
      status: 200,
      body: JSON.stringify({
        id: 'cs_test_9',
        url: 'https://checkout.stripe.com/c/pay/cs_test_9',
      }),
    });

    const before = Math.floor(Date.now() / 1000);
    const session = await gateway.createCheckoutSession(input);
    const after = Math.floor(Date.now() / 1000);

    expect(session).toMatchObject({
      sessionId: 'cs_test_9',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_9',
    });
    // Hạn trả về (ADR-0006 AMEND 1a) phải khớp đúng expires_at đã gửi provider.
    expect(Math.floor(session.expiresAt.getTime() / 1000)).toBeGreaterThanOrEqual(before + 3600);
    expect(Math.floor(session.expiresAt.getTime() / 1000)).toBeLessThanOrEqual(after + 3600);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(call?.headers.authorization).toBe(`Bearer ${SECRET_KEY}`);
    expect(call?.headers['content-type']).toBe('application/x-www-form-urlencoded');
    const params = new URLSearchParams(call?.body);
    expect(params.get('mode')).toBe('payment');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('11700');
    expect(params.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(params.get('line_items[0][price_data][product_data][name]')).toBe(input.description);
    expect(params.get('line_items[0][quantity]')).toBe('1');
    expect(params.get('metadata[bookingId]')).toBe('b-1');
    expect(params.get('metadata[bookingCode]')).toBe('BK-1');
    expect(params.get('success_url')).toBe(input.successUrl);
    expect(params.get('cancel_url')).toBe(input.cancelUrl);
    // Khoá đúng 60 phút (không chỉ ">now"): floor Stripe là 30' TÍNH THEO ĐỒNG HỒ
    // STRIPE — đặt sát floor thì clock-skew âm của máy gọi làm request bị từ
    // chối (đo −86s trong smoke sandbox 04/08). Chừa lề 30' trên floor.
    const expiresAt = Number(params.get('expires_at'));
    expect(expiresAt).toBeGreaterThanOrEqual(before + 3600);
    expect(expiresAt).toBeLessThanOrEqual(after + 3600);
  });

  it('sends zero-decimal amounts unscaled', async () => {
    const { gateway, calls } = makeGateway({
      status: 200,
      body: JSON.stringify({
        id: 'cs_1',
        url: 'https://checkout.stripe.com/c/1',
      }),
    });
    await gateway.createCheckoutSession({
      ...input,
      amount: '500000.00',
      currency: 'VND',
    });
    const params = new URLSearchParams(calls[0]?.body);
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('500000');
    expect(params.get('line_items[0][price_data][currency]')).toBe('vnd');
  });

  it('throws with the Stripe error message on a non-2xx response', async () => {
    const { gateway } = makeGateway({
      status: 400,
      body: JSON.stringify({ error: { message: 'Invalid currency: xxx' } }),
    });
    await expect(gateway.createCheckoutSession(input)).rejects.toThrow(/Invalid currency/);
  });
});

describe('StripeGateway.expireSession', () => {
  it('POSTs /v1/checkout/sessions/{id}/expire (ADR-0006 AMEND 1a)', async () => {
    const { gateway, calls } = makeGateway({
      status: 200,
      body: JSON.stringify({ id: 'cs_test_9', status: 'expired' }),
    });
    await gateway.expireSession('cs_test_9');
    expect(calls[0]?.url).toBe('https://api.stripe.com/v1/checkout/sessions/cs_test_9/expire');
  });

  it('ném khi Stripe từ chối (session không còn open) — caller coi là best-effort', async () => {
    const { gateway } = makeGateway({
      status: 400,
      body: JSON.stringify({ error: { message: 'Session is already expired' } }),
    });
    await expect(gateway.expireSession('cs_dead')).rejects.toThrow(/already expired/);
  });
});

describe('StripeGateway.refund', () => {
  it('POSTs /v1/refunds with payment_intent, minor units and Idempotency-Key', async () => {
    const { gateway, calls } = makeGateway({
      status: 200,
      body: JSON.stringify({ id: 're_1', status: 'succeeded' }),
    });

    const result = await gateway.refund({
      providerPaymentId: 'pi_123',
      amount: '30.00',
      currency: 'USD',
      idempotencyKey: 'refund:b-1:0.00',
    });

    expect(result).toEqual({ providerRefundId: 're_1' });
    const call = calls[0];
    expect(call?.url).toBe('https://api.stripe.com/v1/refunds');
    expect(call?.headers['idempotency-key']).toBe('refund:b-1:0.00');
    const params = new URLSearchParams(call?.body);
    expect(params.get('payment_intent')).toBe('pi_123');
    expect(params.get('amount')).toBe('3000');
  });

  it('omits the Idempotency-Key header when no key is supplied', async () => {
    const { gateway, calls } = makeGateway({
      status: 200,
      body: JSON.stringify({ id: 're_2', status: 'succeeded' }),
    });
    await gateway.refund({
      providerPaymentId: 'pi_123',
      amount: '10.00',
      currency: 'USD',
    });
    expect(calls[0]?.headers['idempotency-key']).toBeUndefined();
  });

  it('throws on a provider error (nothing to ledger)', async () => {
    const { gateway } = makeGateway({
      status: 402,
      body: JSON.stringify({ error: { message: 'Charge already refunded' } }),
    });
    await expect(
      gateway.refund({
        providerPaymentId: 'pi_123',
        amount: '30.00',
        currency: 'USD',
      }),
    ).rejects.toThrow(/already refunded/i);
  });
});

describe('StripeGateway identity', () => {
  it('answers for the STRIPE provider', () => {
    const { gateway } = makeGateway();
    expect(gateway.provider).toBe(PaymentProvider.STRIPE);
  });
});
