import { describe, expect, it } from 'vitest';
import { bookingsHref, parseBookingsSearchParams } from './bookings-query';

/**
 * Trạng thái danh sách bookings nằm TRÊN URL (spec P4b §2.2): searchParams là
 * nguồn sự thật, hai hàm thuần dưới đây là cả hai chiều dịch — đọc URL thành
 * input contract, và dựng URL mới khi admin đổi filter/trang. Mọi nhánh
 * clamp/lọc quyết ở đây, trang và bảng chỉ là người thi hành.
 */
describe('parseBookingsSearchParams', () => {
  it('không param nào → trang 1, limit mặc định của contract, không filter', () => {
    expect(parseBookingsSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('page hợp lệ được giữ nguyên', () => {
    expect(parseBookingsSearchParams({ page: '3' })).toEqual({ page: 3, limit: 20 });
  });

  it('page rác (chữ, 0, âm, thập phân) đều rơi về 1 — Zod server chỉ nhận int ≥ 1', () => {
    for (const page of ['abc', '0', '-2', '1.5', '']) {
      expect(parseBookingsSearchParams({ page })).toEqual({ page: 1, limit: 20 });
    }
  });

  it('param lặp (mảng) lấy giá trị đầu tiên', () => {
    expect(parseBookingsSearchParams({ page: ['2', '9'] })).toEqual({ page: 2, limit: 20 });
  });

  it('status thuộc enum BookingStatus được chuyển thẳng xuống contract', () => {
    expect(parseBookingsSearchParams({ status: 'PAID' })).toEqual({
      page: 1,
      limit: 20,
      status: 'PAID',
    });
  });

  it('status lạ hoặc sai hoa-thường bị BỎ, không ném lỗi — URL do người gõ', () => {
    expect(parseBookingsSearchParams({ status: 'paid' })).toEqual({ page: 1, limit: 20 });
    expect(parseBookingsSearchParams({ status: 'DELETED' })).toEqual({ page: 1, limit: 20 });
  });

  it('q được trim thành search', () => {
    expect(parseBookingsSearchParams({ q: '  NX-123  ' })).toEqual({
      page: 1,
      limit: 20,
      search: 'NX-123',
    });
  });

  it('q rỗng hoặc toàn khoảng trắng KHÔNG thành search (contract min 1)', () => {
    expect(parseBookingsSearchParams({ q: '' })).toEqual({ page: 1, limit: 20 });
    expect(parseBookingsSearchParams({ q: '   ' })).toEqual({ page: 1, limit: 20 });
  });

  it('q dài hơn 120 ký tự bị cắt — vượt trần contract là 400, thà cắt còn hơn vỡ', () => {
    const parsed = parseBookingsSearchParams({ q: 'a'.repeat(200) });
    expect(parsed.search).toHaveLength(120);
  });

  it('gộp cả ba param cùng lúc', () => {
    expect(parseBookingsSearchParams({ page: '4', status: 'REFUNDED', q: 'ann' })).toEqual({
      page: 4,
      limit: 20,
      status: 'REFUNDED',
      search: 'ann',
    });
  });
});

describe('bookingsHref', () => {
  const base = { page: 1, limit: 20 } as const;

  it('không filter, trang 1 → URL trần (page=1 không cần nằm trên URL)', () => {
    expect(bookingsHref(base, {})).toBe('/bookings');
  });

  it('đổi trang giữ nguyên filter đang có', () => {
    expect(bookingsHref({ ...base, status: 'PAID', search: 'ann' }, { page: 3 })).toBe(
      '/bookings?status=PAID&q=ann&page=3',
    );
  });

  it('đổi status ĐẶT LẠI trang về 1 — trang 5 của bộ lọc cũ vô nghĩa với bộ mới', () => {
    expect(bookingsHref({ ...base, page: 5 }, { status: 'PENDING' })).toBe(
      '/bookings?status=PENDING',
    );
  });

  it('đổi search cũng đặt lại trang về 1', () => {
    expect(bookingsHref({ ...base, page: 5, status: 'PAID' }, { search: 'bob' })).toBe(
      '/bookings?status=PAID&q=bob',
    );
  });

  it('null là XOÁ filter (khác undefined = giữ nguyên)', () => {
    expect(bookingsHref({ ...base, status: 'PAID', search: 'ann' }, { status: null })).toBe(
      '/bookings?q=ann',
    );
    expect(bookingsHref({ ...base, status: 'PAID', search: 'ann' }, { search: null })).toBe(
      '/bookings?status=PAID',
    );
  });

  it('search rỗng/toàn khoảng trắng cũng là xoá', () => {
    expect(bookingsHref({ ...base, search: 'ann' }, { search: '   ' })).toBe('/bookings');
  });

  it('ký tự đặc biệt trong search được encode', () => {
    expect(bookingsHref(base, { search: 'a b&c' })).toBe('/bookings?q=a+b%26c');
  });
});
