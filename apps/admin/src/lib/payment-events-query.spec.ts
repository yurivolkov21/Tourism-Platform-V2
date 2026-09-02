import { describe, expect, it } from 'vitest';
import { parsePaymentEventsSearchParams, paymentEventsHref } from './payment-events-query';

/**
 * Trạng thái bảng `/payment-events` sống TRÊN URL (spec P4c §3-F8, cùng
 * khuôn `outbox-query`): bốn filter (provider · type · q = eventId ·
 * unprocessed) + phân trang dùng chung `table-query.ts`. URL là thứ người gõ
 * — mọi giá trị rác rơi về mặc định an toàn, không ném 400 lên API.
 */
describe('parsePaymentEventsSearchParams', () => {
  it('không param nào → trang 1, limit mặc định, KHÔNG filter (bỏ trống = tất cả)', () => {
    expect(parsePaymentEventsSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('cả hai provider của enum contract đều lọc được; giá trị lạ bị BỎ', () => {
    for (const provider of ['STRIPE', 'PAYPAL'] as const) {
      expect(parsePaymentEventsSearchParams({ provider })).toEqual({
        page: 1,
        limit: 20,
        provider,
      });
    }
    expect(parsePaymentEventsSearchParams({ provider: 'SQUARE' })).toEqual({ page: 1, limit: 20 });
  });

  it('type chỉ nhận bốn type gateway biết (Select liệt kê đúng tập đó); chuỗi lạ bị BỎ', () => {
    expect(parsePaymentEventsSearchParams({ type: 'payment.failed' })).toEqual({
      page: 1,
      limit: 20,
      type: 'payment.failed',
    });
    expect(parsePaymentEventsSearchParams({ type: 'checkout.session.completed' })).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('q → search: trim, rỗng thì không lọc, quá dài cắt đúng trần 120', () => {
    expect(parsePaymentEventsSearchParams({ q: '  evt_1Pabc ' })).toEqual({
      page: 1,
      limit: 20,
      search: 'evt_1Pabc',
    });
    expect(parsePaymentEventsSearchParams({ q: '   ' })).toEqual({ page: 1, limit: 20 });
    expect(parsePaymentEventsSearchParams({ q: 'x'.repeat(130) }).search).toHaveLength(120);
  });

  it('unprocessed: CHỈ "true" bật cờ — "1"/"yes"/"false"/vắng đều là không lọc', () => {
    expect(parsePaymentEventsSearchParams({ unprocessed: 'true' })).toEqual({
      page: 1,
      limit: 20,
      unprocessed: true,
    });
    for (const raw of ['false', '1', 'yes', '']) {
      expect(parsePaymentEventsSearchParams({ unprocessed: raw })).toEqual({ page: 1, limit: 20 });
    }
  });

  it('phân trang dùng chung luật clamp (page rác → 1, limit vượt trần → mặc định)', () => {
    expect(parsePaymentEventsSearchParams({ page: '0', limit: '500' })).toEqual({
      page: 1,
      limit: 20,
    });
    expect(
      parsePaymentEventsSearchParams({ page: '3', limit: '50', provider: ['PAYPAL', 'STRIPE'] }),
    ).toEqual({ page: 3, limit: 50, provider: 'PAYPAL' });
  });
});

describe('paymentEventsHref', () => {
  it('trạng thái mặc định → đường dẫn trơn, không query cụt', () => {
    expect(paymentEventsHref({ page: 1, limit: 20 }, {})).toBe('/payment-events');
  });

  it('giữ mọi filter khi chỉ đổi trang; thứ tự param ổn định provider · type · q · unprocessed', () => {
    expect(
      paymentEventsHref(
        {
          page: 1,
          limit: 20,
          provider: 'STRIPE',
          type: 'payment.completed',
          search: 'evt_1',
          unprocessed: true,
        },
        { page: 3 },
      ),
    ).toBe(
      '/payment-events?provider=STRIPE&type=payment.completed&q=evt_1&unprocessed=true&page=3',
    );
  });

  it('đổi provider/type/search/unprocessed ĐẶT LẠI trang về 1, giữ filter khác', () => {
    expect(
      paymentEventsHref({ page: 5, limit: 20, provider: 'STRIPE' }, { provider: 'PAYPAL' }),
    ).toBe('/payment-events?provider=PAYPAL');
    expect(paymentEventsHref({ page: 4, limit: 20, provider: 'STRIPE' }, { type: 'other' })).toBe(
      '/payment-events?provider=STRIPE&type=other',
    );
    expect(paymentEventsHref({ page: 4, limit: 20, provider: 'STRIPE' }, { search: ' evt ' })).toBe(
      '/payment-events?provider=STRIPE&q=evt',
    );
    expect(
      paymentEventsHref({ page: 4, limit: 20, provider: 'STRIPE' }, { unprocessed: true }),
    ).toBe('/payment-events?provider=STRIPE&unprocessed=true');
  });

  it('unprocessed: false hoặc null đều XOÁ cờ khỏi URL (không ghi `unprocessed=false`)', () => {
    const current = { page: 2, limit: 20, unprocessed: true as const };
    expect(paymentEventsHref(current, { unprocessed: false })).toBe('/payment-events');
    expect(paymentEventsHref(current, { unprocessed: null })).toBe('/payment-events');
  });

  it('null XOÁ filter (khác undefined = giữ nguyên)', () => {
    expect(
      paymentEventsHref(
        { page: 2, limit: 20, provider: 'STRIPE', type: 'other', search: 'x', unprocessed: true },
        { provider: null, type: null, search: null, unprocessed: null },
      ),
    ).toBe('/payment-events');
  });

  it('đổi số dòng mỗi trang đặt lại trang 1 và giữ filter', () => {
    expect(paymentEventsHref({ page: 4, limit: 20, provider: 'PAYPAL' }, { limit: 50 })).toBe(
      '/payment-events?provider=PAYPAL&limit=50',
    );
  });

  it('page nói rõ trong patch thì thắng luật reset', () => {
    expect(paymentEventsHref({ page: 4, limit: 20 }, { provider: 'STRIPE', page: 2 })).toBe(
      '/payment-events?provider=STRIPE&page=2',
    );
  });
});
