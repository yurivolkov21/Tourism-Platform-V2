import { describe, expect, it } from 'vitest';
import { outboxHref, parseOutboxSearchParams } from './outbox-query';

/**
 * Trạng thái bảng `/outbox` sống TRÊN URL (spec P4c §3-F7, cùng khuôn
 * `bookings-query`): ba filter (status · type · q = dedupeKey) + phân trang
 * dùng chung `table-query.ts`. URL là thứ người gõ — mọi giá trị rác rơi về
 * mặc định an toàn, không ném 400 lên API.
 */
describe('parseOutboxSearchParams', () => {
  it('không param nào → trang 1, limit mặc định, KHÔNG filter (bỏ trống = tất cả)', () => {
    expect(parseOutboxSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('cả ba trạng thái của enum contract đều lọc được', () => {
    for (const status of ['PENDING', 'SENT', 'FAILED'] as const) {
      expect(parseOutboxSearchParams({ status })).toEqual({ page: 1, limit: 20, status });
    }
  });

  it('type lọc theo EmailType; giá trị lạ bị BỎ, không ném lỗi', () => {
    expect(parseOutboxSearchParams({ type: 'REVIEW_APPROVED' })).toEqual({
      page: 1,
      limit: 20,
      type: 'REVIEW_APPROVED',
    });
    expect(parseOutboxSearchParams({ type: 'newsletter' })).toEqual({ page: 1, limit: 20 });
    expect(parseOutboxSearchParams({ status: 'PAID' })).toEqual({ page: 1, limit: 20 });
  });

  it('q → search: trim, rỗng thì không lọc, quá dài cắt đúng trần 120', () => {
    expect(parseOutboxSearchParams({ q: '  BK-ABCD1234 ' })).toEqual({
      page: 1,
      limit: 20,
      search: 'BK-ABCD1234',
    });
    expect(parseOutboxSearchParams({ q: '   ' })).toEqual({ page: 1, limit: 20 });
    expect(parseOutboxSearchParams({ q: 'x'.repeat(130) }).search).toHaveLength(120);
  });

  it('phân trang dùng chung luật clamp (page rác → 1, limit vượt trần → mặc định)', () => {
    expect(parseOutboxSearchParams({ page: '0', limit: '500' })).toEqual({ page: 1, limit: 20 });
    expect(parseOutboxSearchParams({ page: '3', limit: '50', status: ['FAILED', 'SENT'] })).toEqual(
      { page: 3, limit: 50, status: 'FAILED' },
    );
  });
});

describe('outboxHref', () => {
  it('trạng thái mặc định → đường dẫn trơn, không query cụt', () => {
    expect(outboxHref({ page: 1, limit: 20 }, {})).toBe('/outbox');
  });

  it('giữ mọi filter khi chỉ đổi trang; thứ tự param ổn định status · type · q', () => {
    expect(
      outboxHref(
        { page: 1, limit: 20, status: 'FAILED', type: 'EMAIL_OTP', search: 'BK-1' },
        { page: 3 },
      ),
    ).toBe('/outbox?status=FAILED&type=EMAIL_OTP&q=BK-1&page=3');
  });

  it('đổi status ĐẶT LẠI trang về 1', () => {
    expect(outboxHref({ page: 5, limit: 20, status: 'FAILED' }, { status: 'SENT' })).toBe(
      '/outbox?status=SENT',
    );
  });

  it('đổi type hoặc search cũng đặt lại trang về 1, giữ filter khác', () => {
    expect(
      outboxHref({ page: 4, limit: 20, status: 'FAILED' }, { type: 'BOOKING_CONFIRMATION' }),
    ).toBe('/outbox?status=FAILED&type=BOOKING_CONFIRMATION');
    expect(outboxHref({ page: 4, limit: 20, status: 'FAILED' }, { search: ' BK-2 ' })).toBe(
      '/outbox?status=FAILED&q=BK-2',
    );
  });

  it('null XOÁ filter (khác undefined = giữ nguyên)', () => {
    expect(
      outboxHref(
        { page: 2, limit: 20, status: 'FAILED', type: 'EMAIL_OTP', search: 'x' },
        { status: null, type: null, search: null },
      ),
    ).toBe('/outbox');
  });

  it('đổi số dòng mỗi trang đặt lại trang 1 và giữ filter', () => {
    expect(outboxHref({ page: 4, limit: 20, status: 'PENDING' }, { limit: 50 })).toBe(
      '/outbox?status=PENDING&limit=50',
    );
  });

  it('page nói rõ trong patch thì thắng luật reset', () => {
    expect(outboxHref({ page: 4, limit: 20 }, { status: 'SENT', page: 2 })).toBe(
      '/outbox?status=SENT&page=2',
    );
  });
});
