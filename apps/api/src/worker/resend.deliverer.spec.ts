import { EmailType } from '../generated/prisma/enums.js';
import type { HttpPostCall, HttpPostResponse } from '../lib/provider-http.js';
import { ResendDeliverer, renderEmail } from './resend.deliverer.js';

const OPTS = { apiKey: 're_unit_key', from: 'Tourism <noreply@tourism.test>' };

const BOOKING_PAYLOAD = {
  bookingId: 'b-1',
  code: 'BK-1',
  email: 'buyer@example.com',
  name: 'Alice',
  title: 'Ha Long Bay Cruise',
  amount: '117.00',
  currency: 'USD',
};

function stub(response: HttpPostResponse = { status: 200, body: '{"id":"email-1"}' }) {
  const calls: HttpPostCall[] = [];
  const post = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, ...init });
    return response;
  };
  return { calls, deliverer: new ResendDeliverer(OPTS, post) };
}

describe('renderEmail type → subject mapping', () => {
  const cases: Array<[EmailType, RegExp]> = [
    [EmailType.BOOKING_CONFIRMATION, /Booking BK-1 confirmed/],
    [EmailType.BOOKING_REFUNDED, /Refund issued for booking BK-1/],
    [EmailType.REVIEW_APPROVED, /review/i],
    [EmailType.ENQUIRY_RECEIVED, /enquiry/i],
    [EmailType.CANCELLATION_REQUESTED, /Cancellation request received for booking BK-1/],
    [EmailType.CANCELLATION_APPROVED, /Cancellation approved for booking BK-1/],
    [EmailType.CANCELLATION_DENIED, /Cancellation request denied for booking BK-1/],
    [EmailType.NEWSLETTER_WELCOME, /newsletter/i],
    [EmailType.EMAIL_CHANGED, /email address/i],
  ];

  it.each(cases)('%s has a dedicated subject', (type, expected) => {
    const { subject } = renderEmail(type, BOOKING_PAYLOAD);
    expect(subject).toMatch(expected);
  });

  it('covers every EmailType enum value', () => {
    expect(new Set(cases.map(([type]) => type)).size).toBe(Object.values(EmailType).length);
  });
});

describe('renderEmail payload rendering', () => {
  it('renders name, tour title and money fields into the confirmation html', () => {
    const { html } = renderEmail(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    expect(html).toContain('Alice');
    expect(html).toContain('Ha Long Bay Cruise');
    expect(html).toContain('117.00');
    expect(html).toContain('USD');
    expect(html).toContain('BK-1');
  });

  it('renders the refund reason when present', () => {
    const { html } = renderEmail(EmailType.BOOKING_REFUNDED, {
      ...BOOKING_PAYLOAD,
      reason: 'overbooked',
    });
    expect(html).toContain('overbooked');
  });

  it('renders the denial note when present', () => {
    const { html } = renderEmail(EmailType.CANCELLATION_DENIED, {
      ...BOOKING_PAYLOAD,
      note: 'Departure is within 24h',
    });
    expect(html).toContain('Departure is within 24h');
  });

  it('escapes HTML in user-supplied fields', () => {
    const { html } = renderEmail(EmailType.BOOKING_CONFIRMATION, {
      ...BOOKING_PAYLOAD,
      name: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('degrades gracefully on missing optional fields', () => {
    const { subject, html } = renderEmail(EmailType.NEWSLETTER_WELCOME, {
      email: 'x@example.com',
    });
    expect(subject.length).toBeGreaterThan(0);
    expect(html.length).toBeGreaterThan(0);
  });
});

describe('ResendDeliverer.deliver', () => {
  it('POSTs the rendered email to the Resend API', async () => {
    const { calls, deliverer } = stub();

    await deliverer.deliver(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe('https://api.resend.com/emails');
    expect(call?.headers.authorization).toBe(`Bearer ${OPTS.apiKey}`);
    expect(call?.headers['content-type']).toBe('application/json');
    const body = JSON.parse(call?.body ?? '{}');
    expect(body.from).toBe(OPTS.from);
    expect(body.to).toEqual(['buyer@example.com']);
    expect(body.subject).toBe('Booking BK-1 confirmed');
    expect(body.html).toContain('Alice');
  });

  it('propagates an API error so the outbox drain retries', async () => {
    const { deliverer } = stub({ status: 422, body: '{"message":"Invalid `to`"}' });
    await expect(
      deliverer.deliver(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD),
    ).rejects.toThrow(/Resend/);
  });

  it('throws when the payload has no recipient email', async () => {
    const { calls, deliverer } = stub();
    await expect(
      deliverer.deliver(EmailType.BOOKING_CONFIRMATION, { code: 'BK-1' }),
    ).rejects.toThrow(/email/i);
    expect(calls).toHaveLength(0); // never calls the API with a broken payload
  });
});
