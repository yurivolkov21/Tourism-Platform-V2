import { describe, expect, it } from 'vitest';
import { cancellationsHref, parseCancellationsSearchParams } from './cancellations-query';

/**
 * Trạng thái hàng đợi `/cancellations` sống TRÊN URL như vùng bookings (spec
 * P4b §2.2). Vùng này chỉ có MỘT filter (status) — `AdminCancellationsList
 * QuerySchema` không khai `search` — nên đừng dựng thêm ô tìm kiếm giả rồi
 * lặng lẽ bỏ qua nó.
 */
describe('parseCancellationsSearchParams', () => {
  it('không param nào → trang 1, limit mặc định, KHÔNG filter (contract: bỏ trống = tất cả)', () => {
    expect(parseCancellationsSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('phân trang dùng chung luật clamp với bookings (page rác → 1, limit vượt trần → mặc định)', () => {
    expect(parseCancellationsSearchParams({ page: '0', limit: '500' })).toEqual({
      page: 1,
      limit: 20,
    });
    expect(parseCancellationsSearchParams({ page: '4', limit: '10' })).toEqual({
      page: 4,
      limit: 10,
    });
  });

  it('cả ba trạng thái của enum contract đều lọc được', () => {
    for (const status of ['REQUESTED', 'REFUNDED', 'DENIED'] as const) {
      expect(parseCancellationsSearchParams({ status })).toEqual({ page: 1, limit: 20, status });
    }
  });

  it('status lạ (kể cả của enum booking) bị BỎ, không ném lỗi — URL do người gõ', () => {
    expect(parseCancellationsSearchParams({ status: 'requested' })).toEqual({ page: 1, limit: 20 });
    expect(parseCancellationsSearchParams({ status: 'PAID' })).toEqual({ page: 1, limit: 20 });
  });

  it('param lặp lấy giá trị đầu', () => {
    expect(parseCancellationsSearchParams({ status: ['DENIED', 'REQUESTED'] })).toEqual({
      page: 1,
      limit: 20,
      status: 'DENIED',
    });
  });
});

describe('cancellationsHref', () => {
  it('trạng thái mặc định → đường dẫn trơn, không query cụt', () => {
    expect(cancellationsHref({ page: 1, limit: 20 }, {})).toBe('/cancellations');
  });

  it('giữ filter hiện tại khi chỉ đổi trang', () => {
    expect(cancellationsHref({ page: 1, limit: 20, status: 'REQUESTED' }, { page: 3 })).toBe(
      '/cancellations?status=REQUESTED&page=3',
    );
  });

  it('đổi filter ĐẶT LẠI trang về 1 — trang 5 của bộ lọc cũ gần như chắc chắn rỗng', () => {
    expect(
      cancellationsHref({ page: 5, limit: 20, status: 'REQUESTED' }, { status: 'DENIED' }),
    ).toBe('/cancellations?status=DENIED');
  });

  it('status: null XOÁ filter (khác undefined = giữ nguyên)', () => {
    expect(cancellationsHref({ page: 2, limit: 20, status: 'DENIED' }, { status: null })).toBe(
      '/cancellations',
    );
  });

  it('đổi số dòng mỗi trang cũng đặt lại trang 1 và giữ filter', () => {
    expect(cancellationsHref({ page: 4, limit: 20, status: 'REFUNDED' }, { limit: 50 })).toBe(
      '/cancellations?status=REFUNDED&limit=50',
    );
  });
});
