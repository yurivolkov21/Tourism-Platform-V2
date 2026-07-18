import { PaymentProvider } from '../../generated/prisma/enums.js';
import { FAKE_SIGNATURE_HEADER, FAKE_VALID_SIGNATURE, FakeGateway } from './fake.gateway.js';
import { resolveGateway } from './gateway.js';

const checkoutInput = {
  bookingId: 'b-1',
  code: 'BK-AAAA1111',
  amount: '117.00',
  currency: 'USD',
  description: 'Hội An Walking Tour',
  successUrl: 'http://localhost:3000/checkout/success',
  cancelUrl: 'http://localhost:3000/checkout/cancel',
};

describe('FakeGateway', () => {
  let fake: FakeGateway;

  beforeEach(() => {
    fake = new FakeGateway();
  });

  it('defaults to STRIPE and resolves via resolveGateway', () => {
    expect(fake.provider).toBe(PaymentProvider.STRIPE);
    expect(resolveGateway([fake], PaymentProvider.STRIPE)).toBe(fake);
    expect(() => resolveGateway([fake], PaymentProvider.PAYPAL)).toThrow(/No PaymentGateway/);
    expect(new FakeGateway(PaymentProvider.PAYPAL).provider).toBe(PaymentProvider.PAYPAL);
  });

  it('mints deterministic sessions and records them for inspection', async () => {
    const session = await fake.createCheckoutSession(checkoutInput);
    expect(session).toEqual({
      sessionId: 'fake_cs_1',
      checkoutUrl: 'https://checkout.fake.local/pay/fake_cs_1',
    });
    expect(fake.sessionFor('b-1')?.input).toEqual(checkoutInput);
    expect(fake.sessionFor('b-2')).toBeUndefined();
  });

  it('emits payment.completed defaulting amount/currency from the recorded session', async () => {
    await fake.createCheckoutSession(checkoutInput);
    const event = fake.emitPaymentCompleted('b-1');
    expect(event).toMatchObject({
      type: 'payment.completed',
      bookingId: 'b-1',
      amount: '117.00',
      currency: 'USD',
    });
    // Fresh eventId each emit — unless pinned (duplicate delivery).
    const second = fake.emitPaymentCompleted('b-1');
    expect(second.eventId).not.toBe(event.eventId);
    const dup = fake.emitPaymentCompleted('b-1', { eventId: event.eventId });
    expect(dup.eventId).toBe(event.eventId);
  });

  it('emits orphaned/late events for bookings without a session', () => {
    const orphan = fake.emitPaymentCompleted('never-checked-out', { amount: '10.00' });
    expect(orphan.bookingId).toBe('never-checked-out');
    expect(orphan.amount).toBe('10.00');
    expect(fake.emitPaymentFailed('never-checked-out').type).toBe('payment.failed');
  });

  it('verifyWebhook round-trips an emitted event and rejects bad signatures', async () => {
    await fake.createCheckoutSession(checkoutInput);
    const event = fake.emitPaymentCompleted('b-1');
    const body = JSON.stringify(event);

    const verified = await fake.verifyWebhook(body, {
      [FAKE_SIGNATURE_HEADER]: FAKE_VALID_SIGNATURE,
    });
    expect(verified).toMatchObject({ eventId: event.eventId, type: 'payment.completed' });

    await expect(fake.verifyWebhook(body, {})).rejects.toThrow(/signature/);
    await expect(fake.verifyWebhook(body, { [FAKE_SIGNATURE_HEADER]: 'wrong' })).rejects.toThrow(
      /signature/,
    );
    await expect(
      fake.verifyWebhook('not json', { [FAKE_SIGNATURE_HEADER]: FAKE_VALID_SIGNATURE }),
    ).rejects.toThrow(/not JSON/);
  });

  it('records refunds with deterministic ids and reset() wipes everything', async () => {
    const refund = await fake.refund({
      providerPaymentId: 'fake_pay_b-1',
      amount: '17.00',
      currency: 'USD',
    });
    expect(refund.providerRefundId).toBe('fake_re_1');
    expect(fake.refunds).toHaveLength(1);

    fake.reset();
    expect(fake.sessions).toHaveLength(0);
    expect(fake.refunds).toHaveLength(0);
    const session = await fake.createCheckoutSession(checkoutInput);
    expect(session.sessionId).toBe('fake_cs_1'); // counter restarted
  });
});
