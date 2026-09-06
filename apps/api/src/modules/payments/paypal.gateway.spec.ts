import { PaymentProvider } from '../../generated/prisma/enums.js';
import type { HttpPostCall, HttpPostResponse } from '../../lib/provider-http.js';
import type { VerifiedEvent } from './gateway.js';
import { PayPalGateway } from './paypal.gateway.js';

const OPTS = {
  clientId: 'client-id-unit',
  clientSecret: 'client-secret-unit',
  webhookId: 'WH-ID-UNIT',
};

const SANDBOX = 'https://api-m.sandbox.paypal.com';

type Route = (call: HttpPostCall) => HttpPostResponse;

/**
 * URL-routed httpPost stub — the injectable-HTTP seam that keeps PayPal's
 * API-based webhook verification unit-testable offline (D2 resolved).
 */
function stubHttp(routes: Record<string, Route | HttpPostResponse>) {
  const calls: HttpPostCall[] = [];
  const post = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    const call = { url, ...init };
    calls.push(call);
    const path = new URL(url).pathname;
    const route = routes[path];
    if (!route) throw new Error(`no stub route for ${path}`);
    return typeof route === 'function' ? route(call) : route;
  };
  return { calls, post };
}

function tokenResponse(token = 'token-1', expiresInSec = 3600): HttpPostResponse {
  return {
    status: 200,
    body: JSON.stringify({ access_token: token, expires_in: expiresInSec }),
  };
}

const orderResponse: HttpPostResponse = {
  status: 200,
  body: JSON.stringify({
    id: 'ORDER-1',
    links: [
      { href: `${SANDBOX}/v2/checkout/orders/ORDER-1`, rel: 'self' },
      {
        href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1',
        rel: 'payer-action',
      },
    ],
  }),
};

const CHECKOUT_INPUT = {
  bookingId: 'b-1',
  code: 'BK-1',
  amount: '117.00',
  currency: 'USD',
  description: 'Tour: Ha Long Bay',
  successUrl: 'http://localhost:3000/checkout/success?code=BK-1',
  cancelUrl: 'http://localhost:3000/checkout/cancel?code=BK-1',
};

function captureEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'WH-EVT-1',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: 'CAP-1',
      custom_id: 'b-1',
      amount: { value: '117.00', currency_code: 'USD' },
      // Order gốc của capture — PayPal gửi trong supplementary_data; map ra
      // VerifiedEvent.sessionId (ADR-0006 AMEND 1c).
      supplementary_data: { related_ids: { order_id: 'ORDER-1' } },
      ...overrides,
    },
  };
}

const TRANSMISSION_HEADERS = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/cert.pem',
  'paypal-transmission-id': 'tx-1',
  'paypal-transmission-sig': 'sig-1',
  'paypal-transmission-time': '2026-07-19T00:00:00Z',
};

function verifyRoutes(status: 'SUCCESS' | 'FAILURE' = 'SUCCESS') {
  return stubHttp({
    '/v1/oauth2/token': tokenResponse(),
    '/v1/notifications/verify-webhook-signature': {
      status: 200,
      body: JSON.stringify({ verification_status: status }),
    },
  });
}

describe('PayPalGateway OAuth token', () => {
  it('fetches a client-credentials token with Basic auth and caches it', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse('token-1'),
      '/v2/checkout/orders': orderResponse,
    });
    const gateway = new PayPalGateway(OPTS, http.post);

    await gateway.createCheckoutSession(CHECKOUT_INPUT);
    await gateway.createCheckoutSession(CHECKOUT_INPUT);

    const tokenCalls = http.calls.filter((c) => c.url.endsWith('/v1/oauth2/token'));
    expect(tokenCalls).toHaveLength(1); // cached across both operations
    const basic = Buffer.from(`${OPTS.clientId}:${OPTS.clientSecret}`).toString('base64');
    expect(tokenCalls[0]?.headers.authorization).toBe(`Basic ${basic}`);
    expect(tokenCalls[0]?.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(tokenCalls[0]?.body).toBe('grant_type=client_credentials');
  });

  it('refreshes the token once it nears expiry', async () => {
    let issued = 0;
    const http = stubHttp({
      // expires_in 30s < the 60s refresh margin → every call re-authenticates.
      '/v1/oauth2/token': () => tokenResponse(`token-${++issued}`, 30),
      '/v2/checkout/orders': orderResponse,
    });
    const gateway = new PayPalGateway(OPTS, http.post);

    await gateway.createCheckoutSession(CHECKOUT_INPUT);
    await gateway.createCheckoutSession(CHECKOUT_INPUT);

    expect(issued).toBe(2);
  });

  it('throws when the token endpoint fails', async () => {
    const http = stubHttp({ '/v1/oauth2/token': { status: 401, body: '{}' } });
    const gateway = new PayPalGateway(OPTS, http.post);
    await expect(gateway.createCheckoutSession(CHECKOUT_INPUT)).rejects.toThrow(/oauth/i);
  });
});

describe('PayPalGateway.createCheckoutSession', () => {
  it('creates a CAPTURE order with custom_id=bookingId and returns the approve link', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/checkout/orders': orderResponse,
    });
    const gateway = new PayPalGateway(OPTS, http.post);

    const session = await gateway.createCheckoutSession(CHECKOUT_INPUT);

    expect(session).toMatchObject({
      sessionId: 'ORDER-1',
      checkoutUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1',
    });
    // Hạn khai bảo thủ ~3h (ADR-0006 AMEND 1a) — PayPal không trả hạn nào.
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 3 * 3_600_000);
    const orderCall = http.calls.find((c) => c.url.endsWith('/v2/checkout/orders'));
    expect(orderCall?.headers.authorization).toBe('Bearer token-1');
    expect(orderCall?.headers['content-type']).toBe('application/json');
    const body = JSON.parse(orderCall?.body ?? '{}');
    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units).toEqual([
      {
        reference_id: 'BK-1',
        custom_id: 'b-1',
        description: 'Tour: Ha Long Bay',
        amount: { currency_code: 'USD', value: '117.00' },
      },
    ]);
    expect(body.payment_source.paypal.experience_context).toMatchObject({
      user_action: 'PAY_NOW',
      return_url: CHECKOUT_INPUT.successUrl,
      cancel_url: CHECKOUT_INPUT.cancelUrl,
    });
  });

  it('formats zero-decimal currencies without decimals (PayPal precision rule)', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/checkout/orders': orderResponse,
    });
    const gateway = new PayPalGateway(OPTS, http.post);
    await gateway.createCheckoutSession({
      ...CHECKOUT_INPUT,
      amount: '500000.00',
      currency: 'VND',
    });
    const orderCall = http.calls.find((c) => c.url.endsWith('/v2/checkout/orders'));
    const body = JSON.parse(orderCall?.body ?? '{}');
    expect(body.purchase_units[0].amount).toEqual({
      currency_code: 'VND',
      value: '500000',
    });
  });

  it('throws when the order has no approval link', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/checkout/orders': {
        status: 200,
        body: JSON.stringify({ id: 'ORDER-2', links: [] }),
      },
    });
    const gateway = new PayPalGateway(OPTS, http.post);
    await expect(gateway.createCheckoutSession(CHECKOUT_INPUT)).rejects.toThrow(/approv/i);
  });
});

describe('PayPalGateway.verifyWebhook', () => {
  it('POSTs the verify-webhook-signature payload and maps PAYMENT.CAPTURE.COMPLETED', async () => {
    const http = verifyRoutes('SUCCESS');
    const gateway = new PayPalGateway(OPTS, http.post);
    const body = JSON.stringify(captureEvent());

    const event = await gateway.verifyWebhook(Buffer.from(body), TRANSMISSION_HEADERS);

    expect(event).toMatchObject({
      eventId: 'WH-EVT-1',
      type: 'payment.completed',
      bookingId: 'b-1',
      providerPaymentId: 'CAP-1',
      amount: '117.00',
      currency: 'USD',
      sessionId: 'ORDER-1', // ADR-0006 AMEND 1c — order id từ supplementary_data
    });
    const verifyCall = http.calls.find((c) => c.url.includes('verify-webhook-signature'));
    expect(verifyCall?.headers.authorization).toBe('Bearer token-1');
    const payload = JSON.parse(verifyCall?.body ?? '{}');
    expect(payload).toMatchObject({
      auth_algo: 'SHA256withRSA',
      cert_url: 'https://api.sandbox.paypal.com/cert.pem',
      transmission_id: 'tx-1',
      transmission_sig: 'sig-1',
      transmission_time: '2026-07-19T00:00:00Z',
      webhook_id: OPTS.webhookId,
    });
    expect(payload.webhook_event).toEqual(JSON.parse(body));
  });

  it('throws when PayPal answers anything but SUCCESS', async () => {
    const http = verifyRoutes('FAILURE');
    const gateway = new PayPalGateway(OPTS, http.post);
    await expect(
      gateway.verifyWebhook(JSON.stringify(captureEvent()), TRANSMISSION_HEADERS),
    ).rejects.toThrow(/verification/i);
  });

  it('throws when the verify endpoint itself errors', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v1/notifications/verify-webhook-signature': { status: 500, body: '{}' },
    });
    const gateway = new PayPalGateway(OPTS, http.post);
    await expect(
      gateway.verifyWebhook(JSON.stringify(captureEvent()), TRANSMISSION_HEADERS),
    ).rejects.toThrow(/verif/i);
  });

  it('maps PAYMENT.CAPTURE.DENIED to payment.failed', async () => {
    const http = verifyRoutes('SUCCESS');
    const gateway = new PayPalGateway(OPTS, http.post);
    const body = JSON.stringify({
      ...captureEvent(),
      id: 'WH-EVT-2',
      event_type: 'PAYMENT.CAPTURE.DENIED',
    });
    const event = await gateway.verifyWebhook(body, TRANSMISSION_HEADERS);
    expect(event).toMatchObject({
      eventId: 'WH-EVT-2',
      type: 'payment.failed',
      bookingId: 'b-1',
      providerPaymentId: 'CAP-1',
    });
  });

  it("maps PAYMENT.CAPTURE.REFUNDED (and unknown types) to 'other'", async () => {
    const http = verifyRoutes('SUCCESS');
    const gateway = new PayPalGateway(OPTS, http.post);

    const refunded = await gateway.verifyWebhook(
      JSON.stringify({
        ...captureEvent(),
        id: 'WH-3',
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
      }),
      TRANSMISSION_HEADERS,
    );
    expect(refunded.type).toBe('other');

    const approved = await gateway.verifyWebhook(
      JSON.stringify({
        id: 'WH-4',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: {},
      }),
      TRANSMISSION_HEADERS,
    );
    expect(approved.type).toBe('other');
  });
});

describe('PayPalGateway.refund', () => {
  it('POSTs captures/{id}/refund with PayPal-Request-Id and currency-correct amount', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/payments/captures/CAP-1/refund': {
        status: 201,
        body: JSON.stringify({ id: 'REFUND-1', status: 'COMPLETED' }),
      },
    });
    const gateway = new PayPalGateway(OPTS, http.post);

    const result = await gateway.refund({
      providerPaymentId: 'CAP-1',
      amount: '30.00',
      currency: 'USD',
      idempotencyKey: 'cancel-refund:req-1',
    });

    expect(result).toEqual({ providerRefundId: 'REFUND-1' });
    const call = http.calls.find((c) => c.url.includes('/refund'));
    expect(call?.url).toBe(`${SANDBOX}/v2/payments/captures/CAP-1/refund`);
    expect(call?.headers['paypal-request-id']).toBe('cancel-refund:req-1');
    expect(JSON.parse(call?.body ?? '{}')).toEqual({
      amount: { value: '30.00', currency_code: 'USD' },
    });
  });

  it('omits the PayPal-Request-Id header when no key is supplied', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/payments/captures/CAP-1/refund': {
        status: 201,
        body: JSON.stringify({ id: 'REFUND-2' }),
      },
    });
    const gateway = new PayPalGateway(OPTS, http.post);
    await gateway.refund({
      providerPaymentId: 'CAP-1',
      amount: '10.00',
      currency: 'USD',
    });
    const call = http.calls.find((c) => c.url.includes('/refund'));
    expect(call?.headers['paypal-request-id']).toBeUndefined();
  });

  it('throws on a provider error (nothing to ledger)', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/payments/captures/CAP-1/refund': {
        status: 422,
        body: JSON.stringify({
          name: 'UNPROCESSABLE_ENTITY',
          message: 'CAPTURE_FULLY_REFUNDED',
        }),
      },
    });
    const gateway = new PayPalGateway(OPTS, http.post);
    await expect(
      gateway.refund({
        providerPaymentId: 'CAP-1',
        amount: '30.00',
        currency: 'USD',
      }),
    ).rejects.toThrow(/CAPTURE_FULLY_REFUNDED/);
  });
});

describe('PayPalGateway.followUp', () => {
  /** VerifiedEvent bọc raw CHECKOUT.ORDER.APPROVED — `type` map thành `other` (mapPayPalEvent). */
  function approvedEvent(resourceOverrides: Record<string, unknown> = {}): VerifiedEvent {
    return {
      eventId: 'WH-EVT-APPROVED',
      type: 'other',
      raw: {
        id: 'WH-EVT-APPROVED',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: 'ORDER-9', ...resourceOverrides },
      },
    };
  }

  function completedEvent(): VerifiedEvent {
    return {
      eventId: 'WH-EVT-OTHER',
      type: 'payment.completed',
      bookingId: 'b-1',
      raw: {
        id: 'WH-EVT-OTHER',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAP-1' },
      },
    };
  }

  it('captures the order on CHECKOUT.ORDER.APPROVED with idempotent Request-Id', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/checkout/orders/ORDER-9/capture': {
        status: 201,
        body: JSON.stringify({ id: 'CAP-9', status: 'COMPLETED' }),
      },
    });
    const gateway = new PayPalGateway(OPTS, http.post);

    await gateway.followUp(approvedEvent());

    const captureCall = http.calls.find((c) =>
      c.url.endsWith('/v2/checkout/orders/ORDER-9/capture'),
    );
    expect(captureCall).toBeDefined();
    expect(captureCall?.headers['paypal-request-id']).toBe('capture:ORDER-9');
    expect(captureCall?.headers.authorization).toBe('Bearer token-1');
  });

  it('does nothing for events other than CHECKOUT.ORDER.APPROVED (no HTTP call)', async () => {
    const http = stubHttp({});
    const gateway = new PayPalGateway(OPTS, http.post);

    await gateway.followUp(completedEvent());

    expect(http.calls).toHaveLength(0);
  });

  it('warns and returns without throwing when resource.id is missing', async () => {
    const http = stubHttp({});
    const gateway = new PayPalGateway(OPTS, http.post);

    await expect(gateway.followUp(approvedEvent({ id: undefined }))).resolves.toBeUndefined();
    expect(http.calls).toHaveLength(0);
  });

  it('swallows ORDER_ALREADY_CAPTURED as an idempotent success', async () => {
    // Shape 422 THẬT của PayPal: mã máy-đọc-được nằm ở details[0].issue,
    // message top-level chỉ là boilerplate ("The requested action could not
    // be performed..."), KHÔNG chứa "ORDER_ALREADY_CAPTURED".
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/checkout/orders/ORDER-9/capture': {
        status: 422,
        body: JSON.stringify({
          name: 'UNPROCESSABLE_ENTITY',
          message:
            'The requested action could not be performed, semantically incorrect, or failed business validation.',
          details: [{ issue: 'ORDER_ALREADY_CAPTURED' }],
        }),
      },
    });
    const gateway = new PayPalGateway(OPTS, http.post);

    await expect(gateway.followUp(approvedEvent())).resolves.toBeUndefined();
  });

  it('throws when details[0].issue is a different error (not ALREADY_CAPTURED)', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/checkout/orders/ORDER-9/capture': {
        status: 422,
        body: JSON.stringify({
          name: 'UNPROCESSABLE_ENTITY',
          message:
            'The requested action could not be performed, semantically incorrect, or failed business validation.',
          details: [{ issue: 'INSTRUMENT_DECLINED' }],
        }),
      },
    });
    const gateway = new PayPalGateway(OPTS, http.post);

    await expect(gateway.followUp(approvedEvent())).rejects.toThrow();
  });

  it('throws on other capture errors so the provider retries the webhook', async () => {
    const http = stubHttp({
      '/v1/oauth2/token': tokenResponse(),
      '/v2/checkout/orders/ORDER-9/capture': { status: 503, body: '{}' },
    });
    const gateway = new PayPalGateway(OPTS, http.post);

    await expect(gateway.followUp(approvedEvent())).rejects.toThrow();
  });
});

describe('PayPalGateway identity', () => {
  it('answers for the PAYPAL provider', () => {
    const http = verifyRoutes();
    expect(new PayPalGateway(OPTS, http.post).provider).toBe(PaymentProvider.PAYPAL);
  });
});
