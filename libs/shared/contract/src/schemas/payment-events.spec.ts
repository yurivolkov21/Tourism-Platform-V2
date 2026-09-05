import { PaymentProviderSchema } from './bookings.js';
import {
  AdminPaymentEventByIdInputSchema,
  AdminPaymentEventsListQuerySchema,
  PAYMENT_EVENT_TYPES,
  PaymentEventDetailSchema,
  PaymentEventRowSchema,
  PaymentEventTypeSchema,
} from './payment-events.js';
import {
  AdminPaymentEventsStatsSchema,
  PAYMENT_EVENT_STUCK_MINUTES,
  STATS_WINDOW_DAYS,
} from './stats.js';

/**
 * Contract vùng payment events (spec P4c §3-F8) — sổ webhook Stripe/PayPal,
 * HOÀN TOÀN đọc. Test pin đúng những gì API và admin dựa vào: trần/cận của
 * query (kể cả cờ `unprocessed` là boolean thuần để ZodSmartCoercion ép
 * "true"/"false"), hình dạng row (KHÔNG mang payload — chỉ `byId` mới có),
 * và tập type hữu hạn mà Select lọc của admin liệt kê.
 */

const validRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  provider: 'STRIPE',
  eventId: 'evt_1Pabc123',
  type: 'payment.completed',
  amount: '117.00',
  currency: 'USD',
  bookingCode: 'BK-ABCD1234',
  receivedAt: '2026-09-01T10:00:00.000Z',
  processedAt: '2026-09-01T10:00:01.000Z',
};

describe('PaymentEventTypeSchema', () => {
  it('enum của đúng tuple — Select admin hỏi "gateway có biết type này không" qua nó', () => {
    expect([...PaymentEventTypeSchema.options]).toEqual([...PAYMENT_EVENT_TYPES]);
    expect(PaymentEventTypeSchema.safeParse('payment.chargeback').success).toBe(false);
  });
});

describe('PAYMENT_EVENT_TYPES', () => {
  it('là bốn type trung lập provider mà gateway phát ra — nguồn của Select lọc admin', () => {
    expect(PAYMENT_EVENT_TYPES).toEqual([
      'payment.completed',
      'payment.failed',
      'payment.expired',
      'other',
    ]);
  });
});

describe('AdminPaymentEventsListQuerySchema', () => {
  it('mặc định trang 1 · 20 dòng, không filter', () => {
    expect(AdminPaymentEventsListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('nhận provider từ enum, type ≤100, search ≤120, unprocessed boolean', () => {
    expect(
      AdminPaymentEventsListQuerySchema.parse({
        provider: 'PAYPAL',
        type: 'payment.failed',
        search: 'evt_',
        unprocessed: true,
      }),
    ).toMatchObject({
      provider: 'PAYPAL',
      type: 'payment.failed',
      search: 'evt_',
      unprocessed: true,
    });
    expect(AdminPaymentEventsListQuerySchema.safeParse({ search: 'x'.repeat(121) }).success).toBe(
      false,
    );
    expect(AdminPaymentEventsListQuerySchema.safeParse({ type: 'x'.repeat(101) }).success).toBe(
      false,
    );
    expect(AdminPaymentEventsListQuerySchema.safeParse({ search: '' }).success).toBe(false);
  });

  it('từ chối provider ngoài enum, unprocessed không phải boolean, limit vượt trần 100', () => {
    expect(AdminPaymentEventsListQuerySchema.safeParse({ provider: 'SQUARE' }).success).toBe(false);
    // Boolean THUẦN chứ không phải z.coerce: "yes" không được lặng lẽ thành true.
    expect(AdminPaymentEventsListQuerySchema.safeParse({ unprocessed: 'yes' }).success).toBe(false);
    expect(AdminPaymentEventsListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('giữ nguyên `.shape` — điều kiện để ZodSmartCoercionPlugin ép query string', () => {
    expect(Object.keys(AdminPaymentEventsListQuerySchema.shape)).toEqual([
      'page',
      'limit',
      'provider',
      'type',
      'search',
      'unprocessed',
    ]);
  });

  it('provider dùng CHÍNH enum PaymentProvider của bookings — không có bản gương thứ hai', () => {
    expect(AdminPaymentEventsListQuerySchema.shape.provider.unwrap()).toBe(PaymentProviderSchema);
  });
});

describe('PaymentEventRowSchema', () => {
  it('nhận một row đã xử lý đầy đủ — và KHÔNG mang payload (list không chở JSON)', () => {
    expect(PaymentEventRowSchema.parse({ ...validRow, payload: { leaked: true } })).toEqual(
      validRow,
    );
  });

  it('event `other`/chưa xử lý: amount, currency, bookingCode, processedAt đều có thể null', () => {
    const bare = {
      ...validRow,
      type: 'other',
      amount: null,
      currency: null,
      bookingCode: null,
      processedAt: null,
    };
    expect(PaymentEventRowSchema.parse(bare)).toEqual(bare);
  });

  it('amount là chuỗi thập phân — không bao giờ float; bookingCode phải đúng dạng BK-', () => {
    expect(PaymentEventRowSchema.safeParse({ ...validRow, amount: 117 }).success).toBe(false);
    expect(PaymentEventRowSchema.safeParse({ ...validRow, bookingCode: 'nope' }).success).toBe(
      false,
    );
  });
});

describe('PaymentEventDetailSchema', () => {
  it('= row + payload JSON lồng nhau nguyên vẹn', () => {
    const detail = {
      ...validRow,
      payload: { id: 'evt_1', data: { object: { amount_total: 11700 } } },
    };
    expect(PaymentEventDetailSchema.parse(detail)).toEqual(detail);
    expect(PaymentEventDetailSchema.safeParse(validRow).success).toBe(false);
  });
});

describe('AdminPaymentEventByIdInputSchema', () => {
  it('chỉ nhận uuid', () => {
    expect(AdminPaymentEventByIdInputSchema.parse({ id: validRow.id })).toEqual({
      id: validRow.id,
    });
    expect(AdminPaymentEventByIdInputSchema.safeParse({ id: 'evt_1' }).success).toBe(false);
  });
});

describe('AdminPaymentEventsStatsSchema', () => {
  const period = {
    windowDays: STATS_WINDOW_DAYS,
    currentFrom: '2026-08-04T00:00:00.000Z',
    currentTo: '2026-09-01T00:00:00.000Z',
    previousFrom: '2026-07-07T00:00:00.000Z',
    generatedAt: '2026-09-01T00:00:00.000Z',
    picked: false,
  };

  it('received/linked là CẶP hai kỳ (neo receivedAt); unprocessed/stuck là ẢNH CHỤP số đơn', () => {
    const stats = {
      period,
      received: { current: 40, previous: 35 },
      unprocessed: 2,
      stuck: 1,
      linked: { current: 30, previous: 28 },
    };
    expect(AdminPaymentEventsStatsSchema.parse(stats)).toEqual(stats);
    // `stuck` là BẮT BUỘC (vòng vá review F8) — thiếu nó card không biết khi nào kêu đỏ.
    expect(AdminPaymentEventsStatsSchema.safeParse({ ...stats, stuck: undefined }).success).toBe(
      false,
    );
    expect(PAYMENT_EVENT_STUCK_MINUTES).toBe(5);
    // Ảnh chụp không có kỳ trước để so — một cặp ở đây là số bịa (luật F5/F7).
    expect(
      AdminPaymentEventsStatsSchema.safeParse({
        ...stats,
        unprocessed: { current: 2, previous: 1 },
      }).success,
    ).toBe(false);
    // Cặp thiếu `previous` là vi phạm bất biến "server trả cả hai số".
    expect(
      AdminPaymentEventsStatsSchema.safeParse({ ...stats, received: { current: 40 } }).success,
    ).toBe(false);
  });
});
