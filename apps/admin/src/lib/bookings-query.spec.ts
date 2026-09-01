import { describe, expect, it } from 'vitest';
import { bookingsExportHref, bookingsHref, parseBookingsSearchParams } from './bookings-query';

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

  it('limit hợp lệ được giữ — ô "Rows per page" cũng là trạng thái trên URL', () => {
    expect(parseBookingsSearchParams({ limit: '50' })).toEqual({ page: 1, limit: 50 });
  });

  it('limit rác hoặc vượt trần 100 của contract rơi về mặc định 20', () => {
    for (const limit of ['abc', '0', '-5', '2.5', '101', '9999']) {
      expect(parseBookingsSearchParams({ limit })).toEqual({ page: 1, limit: 20 });
    }
  });

  // ── F6: khoảng ngày createdAt (spec P4b §3-F6) ─────────────────────────
  it('from/to đúng dạng YYYY-MM-DD đi thẳng xuống contract', () => {
    expect(parseBookingsSearchParams({ from: '2026-09-01', to: '2026-09-30' })).toEqual({
      page: 1,
      limit: 20,
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('ngày sai định dạng hoặc không tồn tại bị BỎ — cùng mức khoan dung với status rác', () => {
    for (const from of ['01/09/2026', '2026-9-1', '2026-02-31', 'yesterday', '']) {
      expect(parseBookingsSearchParams({ from })).toEqual({ page: 1, limit: 20 });
    }
    expect(parseBookingsSearchParams({ to: '2026-13-01' })).toEqual({ page: 1, limit: 20 });
  });

  it('năm ngoài trần 1900–2099 của contract cũng rơi im lặng — không bao giờ dựng href 400', () => {
    // Cùng CalendarDateSchema với contract (vòng vá review F6): nếu chỉ server
    // siết thì admin vẫn dựng được href hợp lệ-theo-luật-cũ và cú click chết 400.
    for (const value of ['9999-12-31', '0050-06-01', '1899-12-31']) {
      expect(parseBookingsSearchParams({ from: value })).toEqual({ page: 1, limit: 20 });
      expect(parseBookingsSearchParams({ to: value })).toEqual({ page: 1, limit: 20 });
    }
  });

  it('mốc ISO có giờ bị bỏ — contract chỉ nhận ngày lịch', () => {
    expect(parseBookingsSearchParams({ from: '2026-09-01T00:00:00.000Z' })).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('khoảng NGƯỢC (from > to) giữ from và bỏ to — không bao giờ gửi 400 lên API', () => {
    // Bỏ CẢ HAI thì bảng lặng lẽ hiện mọi booking trong khi URL vẫn mang hai
    // ngày; bỏ `to` để ô ngày kết thúc trống — người gõ thấy ngay cái bị loại.
    expect(parseBookingsSearchParams({ from: '2026-09-30', to: '2026-09-01' })).toEqual({
      page: 1,
      limit: 20,
      from: '2026-09-30',
    });
  });

  it('from === to là hợp lệ (trọn một ngày)', () => {
    expect(parseBookingsSearchParams({ from: '2026-09-15', to: '2026-09-15' })).toMatchObject({
      from: '2026-09-15',
      to: '2026-09-15',
    });
  });

  it('gộp cả bốn param cùng lúc', () => {
    expect(
      parseBookingsSearchParams({ page: '4', status: 'REFUNDED', q: 'ann', limit: '10' }),
    ).toEqual({
      page: 4,
      limit: 10,
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

  it('đổi số dòng/trang ĐẶT LẠI trang về 1 — trang 5 cỡ 10 không còn nghĩa ở cỡ 50', () => {
    expect(bookingsHref({ ...base, page: 5 }, { limit: 50 })).toBe('/bookings?limit=50');
  });

  it('limit mặc định (20) không nằm trên URL', () => {
    expect(bookingsHref({ ...base, limit: 50 }, { limit: 20 })).toBe('/bookings');
  });

  it('limit đang khác mặc định thì đi theo mọi link khác (đổi trang, đổi filter)', () => {
    expect(bookingsHref({ page: 1, limit: 10, status: 'PAID' }, { page: 2 })).toBe(
      '/bookings?status=PAID&limit=10&page=2',
    );
  });

  // ── F6 ────────────────────────────────────────────────────────────────
  it('đặt khoảng ngày ĐẶT LẠI trang về 1 và đi cùng các filter khác', () => {
    expect(bookingsHref({ ...base, page: 4, status: 'PAID' }, { from: '2026-09-01' })).toBe(
      '/bookings?status=PAID&from=2026-09-01',
    );
    expect(bookingsHref({ ...base, from: '2026-09-01' }, { to: '2026-09-30' })).toBe(
      '/bookings?from=2026-09-01&to=2026-09-30',
    );
  });

  it('null xoá một đầu của khoảng, đầu kia ở lại', () => {
    const current = { ...base, from: '2026-09-01', to: '2026-09-30' };
    expect(bookingsHref(current, { from: null })).toBe('/bookings?to=2026-09-30');
    expect(bookingsHref(current, { to: null })).toBe('/bookings?from=2026-09-01');
  });

  it('chuỗi rỗng (ô date bị xoá trắng) cũng là xoá', () => {
    expect(bookingsHref({ ...base, from: '2026-09-01' }, { from: '' })).toBe('/bookings');
  });

  it('ngày rác từ patch bị bỏ thay vì ném lên URL', () => {
    expect(bookingsHref(base, { from: '2026-02-31' })).toBe('/bookings');
  });

  it('đổi trang giữ nguyên khoảng ngày', () => {
    expect(bookingsHref({ ...base, from: '2026-09-01', to: '2026-09-30' }, { page: 2 })).toBe(
      '/bookings?from=2026-09-01&to=2026-09-30&page=2',
    );
  });
});

/**
 * Link "Export CSV" trỏ tới route handler xuất ĐÚNG tập đang lọc — nên nó
 * mang mọi filter và CỐ Ý bỏ phân trang: file là cả tập, không phải trang
 * đang xem.
 */
describe('bookingsExportHref', () => {
  const base = { page: 1, limit: 20 } as const;

  it('không filter → đường trần', () => {
    expect(bookingsExportHref(base)).toBe('/bookings/export');
  });

  it('mang theo status/q/from/to', () => {
    expect(
      bookingsExportHref({
        ...base,
        status: 'PAID',
        search: 'ann',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    ).toBe('/bookings/export?status=PAID&q=ann&from=2026-09-01&to=2026-09-30');
  });

  it('KHÔNG mang page/limit — xuất cả tập, không phải trang đang xem', () => {
    expect(bookingsExportHref({ page: 7, limit: 50, status: 'PAID' })).toBe(
      '/bookings/export?status=PAID',
    );
  });
});
