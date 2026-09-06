import { PAYMENT_EVENT_TYPES } from '@tourism/contract';
import { type PaymentEvent, Prisma } from '../../generated/prisma/client.js';
import { PaymentProvider } from '../../generated/prisma/enums.js';
import { REDACTED } from '../../lib/redact.js';
import type { VerifiedEvent } from './gateway.js';
import { toPaymentEventDetail, toPaymentEventRow } from './payment-event-row.js';

/**
 * Mapper THUẦN row Prisma `payment_events` → `PaymentEventRow`/`Detail` của
 * contract (spec P4c §3-F8). Ba chỗ có luật: tiền Decimal → chuỗi 2 số lẻ
 * (không float), mốc thời gian ra ISO UTC / null, và REDACT khoá credential
 * trong payload provider (bài học bảo mật F7 — soi payload thật, xem JSDoc
 * mapper cho kết luận).
 */

const base: PaymentEvent = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  provider: PaymentProvider.STRIPE,
  eventId: 'evt_1Pabc123',
  type: 'payment.completed',
  payload: {
    id: 'evt_1Pabc123',
    type: 'checkout.session.completed',
    data: { object: { amount_total: 11700, currency: 'usd', metadata: { bookingId: 'b-1' } } },
  },
  amount: new Prisma.Decimal('117.00'),
  currency: 'USD',
  bookingId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  note: null,
  processedAt: new Date('2026-09-01T10:00:01.000Z'),
  receivedAt: new Date('2026-09-01T10:00:00.000Z'),
};

describe('PAYMENT_EVENT_TYPES soi gương union `VerifiedEvent["type"]` của gateway', () => {
  it('hai chiều: tuple ⊆ union (satisfies) và union ⊆ tuple (Record ép đủ khoá)', () => {
    // Chiều 1 — mọi phần tử tuple là một type gateway biết (đỏ typecheck nếu sai).
    const tuple = PAYMENT_EVENT_TYPES satisfies readonly VerifiedEvent['type'][];
    // Chiều 2 — mọi type của gateway phải có mặt: thêm type thứ năm vào union
    // mà quên contract là object này thiếu khoá → đỏ typecheck.
    const exhaustive: Record<VerifiedEvent['type'], (typeof PAYMENT_EVENT_TYPES)[number]> = {
      'payment.completed': 'payment.completed',
      'payment.failed': 'payment.failed',
      'payment.expired': 'payment.expired',
      other: 'other',
    };
    expect([...Object.keys(exhaustive)].sort()).toEqual([...tuple].sort());
  });
});

describe('toPaymentEventRow', () => {
  it('row đã xử lý: Decimal → chuỗi "117.00", mốc ISO UTC, bookingCode do caller join', () => {
    expect(toPaymentEventRow(base, 'BK-ABCD1234')).toEqual({
      id: base.id,
      provider: 'STRIPE',
      eventId: 'evt_1Pabc123',
      type: 'payment.completed',
      amount: '117.00',
      currency: 'USD',
      bookingCode: 'BK-ABCD1234',
      receivedAt: '2026-09-01T10:00:00.000Z',
      processedAt: '2026-09-01T10:00:01.000Z',
    });
  });

  it('KHÔNG mang payload — list không chở JSON, drawer gọi byId', () => {
    expect(toPaymentEventRow(base, null)).not.toHaveProperty('payload');
  });

  it('event `other` chưa xử lý: amount/currency/bookingCode/processedAt null giữ null', () => {
    const row = toPaymentEventRow(
      { ...base, type: 'other', amount: null, currency: null, bookingId: null, processedAt: null },
      null,
    );
    expect(row).toMatchObject({
      type: 'other',
      amount: null,
      currency: null,
      bookingCode: null,
      processedAt: null,
    });
  });

  it('tiền luôn đủ HAI số lẻ dù DB trả Decimal tròn — "500000" của PayPal VND thành "500000.00"', () => {
    expect(toPaymentEventRow({ ...base, amount: new Prisma.Decimal('500000') }, null).amount).toBe(
      '500000.00',
    );
  });
});

describe('toPaymentEventDetail', () => {
  it('= row + payload nguyên vẹn khi không có khoá bí mật', () => {
    const detail = toPaymentEventDetail(base, 'BK-ABCD1234');
    expect(detail).toMatchObject(toPaymentEventRow(base, 'BK-ABCD1234'));
    expect(detail.payload).toEqual(base.payload);
  });
});

describe('redact credential trong payload provider', () => {
  const CLIENT_SECRET = 'pi_3Pabc_secret_TOPSECRETVALUE';

  it('Stripe payment_intent.payment_failed mang `client_secret` LỒNG trong data.object — bị che, phần còn lại giữ nguyên', () => {
    const detail = toPaymentEventDetail(
      {
        ...base,
        type: 'payment.failed',
        payload: {
          id: 'evt_2',
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_3Pabc',
              client_secret: CLIENT_SECRET,
              last_payment_error: { message: 'card_declined' },
            },
          },
        },
      },
      null,
    );
    expect(detail.payload).toEqual({
      id: 'evt_2',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_3Pabc',
          client_secret: REDACTED,
          last_payment_error: { message: 'card_declined' },
        },
      },
    });
    expect(JSON.stringify(detail)).not.toContain('TOPSECRETVALUE');
  });

  it('payload đi qua máy che dùng chung: PayPal links[].access_token bị che, href giữ (luật ở lib/redact.spec)', () => {
    const detail = toPaymentEventDetail(
      {
        ...base,
        payload: { links: [{ href: 'https://api.paypal.com/x', access_token: 'abc' }] },
      },
      null,
    );
    expect(detail.payload).toEqual({
      links: [{ href: 'https://api.paypal.com/x', access_token: REDACTED }],
    });
  });

  it('email/tên khách trong customer_details KHÔNG bị che — PII hiện theo spec §2.3 (bảng bookings đã hiện)', () => {
    const detail = toPaymentEventDetail(
      {
        ...base,
        payload: {
          data: { object: { customer_details: { email: 'ada@example.com', name: 'Ada' } } },
        },
      },
      null,
    );
    expect(detail.payload).toEqual({
      data: { object: { customer_details: { email: 'ada@example.com', name: 'Ada' } } },
    });
  });
});
