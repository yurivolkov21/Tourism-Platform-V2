import { describe, expect, it } from 'vitest';
import {
  bookingDetailHref,
  bookingsBackHref,
  bookingsExportHref,
  bookingsHref,
  parseBookingsSearchParams,
} from './bookings-query';

/**
 * Trạng thái danh sách bookings nằm TRÊN URL (spec P4b §2.2): searchParams là
 * nguồn sự thật, hai hàm thuần dưới đây là cả hai chiều dịch — đọc URL thành
 * input contract, và dựng URL mới khi admin đổi filter/trang. Mọi nhánh
 * clamp/lọc quyết ở đây, trang và bảng chỉ là người thi hành.
 */
/**
 * Mốc cố định cho mọi lần gọi — từ 04/09 hàm nhận `now` để biết "tháng hiện
 * tại" là tháng nào (mặc định khoảng ngày, xem describe cuối file).
 */
const NOW = new Date('2026-09-04T10:00:00.000Z');

/**
 * Test cũ nói về paging/status/search, không nói về ngày — nên chúng đi kèm
 * `dates: 'all'` để tắt khoảng ngày mặc định. Không có nó thì mỗi assertion
 * phải mang thêm hai ngày chẳng liên quan tới điều nó đang khẳng định.
 */
const ALL: Record<string, string> = { dates: 'all' };
const NO_DATES = { allDates: true } as const;

describe('parseBookingsSearchParams', () => {
  it('không param nào → trang 1, limit mặc định của contract, không filter', () => {
    expect(parseBookingsSearchParams(ALL, NOW)).toEqual({ page: 1, limit: 20, ...NO_DATES });
  });

  it('page hợp lệ được giữ nguyên', () => {
    expect(parseBookingsSearchParams({ ...ALL, page: '3' }, NOW)).toEqual({
      page: 3,
      limit: 20,
      ...NO_DATES,
    });
  });

  it('page rác (chữ, 0, âm, thập phân) đều rơi về 1 — Zod server chỉ nhận int ≥ 1', () => {
    for (const page of ['abc', '0', '-2', '1.5', '']) {
      expect(parseBookingsSearchParams({ ...ALL, page }, NOW)).toEqual({
        page: 1,
        limit: 20,
        ...NO_DATES,
      });
    }
  });

  it('param lặp (mảng) lấy giá trị đầu tiên', () => {
    expect(parseBookingsSearchParams({ ...ALL, page: ['2', '9'] }, NOW)).toEqual({
      page: 2,
      limit: 20,
      ...NO_DATES,
    });
  });

  it('status thuộc enum BookingStatus được chuyển thẳng xuống contract', () => {
    expect(parseBookingsSearchParams({ ...ALL, status: 'PAID' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      ...NO_DATES,
      status: 'PAID',
    });
  });

  it('status lạ hoặc sai hoa-thường bị BỎ, không ném lỗi — URL do người gõ', () => {
    expect(parseBookingsSearchParams({ ...ALL, status: 'paid' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      ...NO_DATES,
    });
    expect(parseBookingsSearchParams({ ...ALL, status: 'DELETED' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      ...NO_DATES,
    });
  });

  it('q được trim thành search', () => {
    expect(parseBookingsSearchParams({ ...ALL, q: '  NX-123  ' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      ...NO_DATES,
      search: 'NX-123',
    });
  });

  it('q rỗng hoặc toàn khoảng trắng KHÔNG thành search (contract min 1)', () => {
    expect(parseBookingsSearchParams({ ...ALL, q: '' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      ...NO_DATES,
    });
    expect(parseBookingsSearchParams({ ...ALL, q: '   ' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      ...NO_DATES,
    });
  });

  it('q dài hơn 120 ký tự bị cắt — vượt trần contract là 400, thà cắt còn hơn vỡ', () => {
    const parsed = parseBookingsSearchParams({ ...ALL, q: 'a'.repeat(200) }, NOW);
    expect(parsed.search).toHaveLength(120);
  });

  it('limit hợp lệ được giữ — ô "Rows per page" cũng là trạng thái trên URL', () => {
    expect(parseBookingsSearchParams({ ...ALL, limit: '50' }, NOW)).toEqual({
      page: 1,
      limit: 50,
      ...NO_DATES,
    });
  });

  it('limit rác hoặc vượt trần 100 của contract rơi về mặc định 20', () => {
    for (const limit of ['abc', '0', '-5', '2.5', '101', '9999']) {
      expect(parseBookingsSearchParams({ ...ALL, limit }, NOW)).toEqual({
        page: 1,
        limit: 20,
        ...NO_DATES,
      });
    }
  });

  // ── F6: khoảng ngày createdAt (spec P4b §3-F6) ─────────────────────────
  it('from/to đúng dạng YYYY-MM-DD đi thẳng xuống contract', () => {
    expect(parseBookingsSearchParams({ from: '2026-09-01', to: '2026-09-30' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('ngày rác bị BỎ rồi rơi về THÁNG NÀY, không phải về "tất cả"', () => {
    // Từ 04/09 ngày rác không còn mở toang cả tập nữa: bỏ xong thì mặc định
    // tháng hiện tại độn vào. Mở toang vì một ký tự gõ nhầm là đắt hơn nhiều
    // so với hiện sai một tháng.
    const MONTH = { from: '2026-09-01', to: '2026-09-30' };
    for (const from of ['01/09/2026', '2026-9-1', '2026-02-31', 'yesterday', '']) {
      expect(parseBookingsSearchParams({ from }, NOW)).toEqual({ page: 1, limit: 20, ...MONTH });
    }
    expect(parseBookingsSearchParams({ to: '2026-13-01' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      ...MONTH,
    });
  });

  it('năm ngoài trần 1900–2099 của contract cũng rơi im lặng — không bao giờ dựng href 400', () => {
    // Cùng CalendarDateSchema với contract (vòng vá review F6): nếu chỉ server
    // siết thì admin vẫn dựng được href hợp lệ-theo-luật-cũ và cú click chết 400.
    for (const value of ['9999-12-31', '0050-06-01', '1899-12-31']) {
      expect(parseBookingsSearchParams({ ...ALL, from: value }, NOW)).toEqual({
        page: 1,
        limit: 20,
        ...NO_DATES,
      });
      expect(parseBookingsSearchParams({ ...ALL, to: value }, NOW)).toEqual({
        page: 1,
        limit: 20,
        ...NO_DATES,
      });
    }
  });

  it('mốc ISO có giờ bị bỏ — contract chỉ nhận ngày lịch', () => {
    expect(parseBookingsSearchParams({ ...ALL, from: '2026-09-01T00:00:00.000Z' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      ...NO_DATES,
    });
  });

  it('khoảng NGƯỢC (from > to) giữ from và bỏ to — không bao giờ gửi 400 lên API', () => {
    // Bỏ CẢ HAI thì bảng lặng lẽ hiện mọi booking trong khi URL vẫn mang hai
    // ngày; bỏ `to` để ô ngày kết thúc trống — người gõ thấy ngay cái bị loại.
    expect(parseBookingsSearchParams({ from: '2026-09-30', to: '2026-09-01' }, NOW)).toEqual({
      page: 1,
      limit: 20,
      from: '2026-09-30',
    });
  });

  it('from === to là hợp lệ (trọn một ngày)', () => {
    expect(
      parseBookingsSearchParams({ ...ALL, from: '2026-09-15', to: '2026-09-15' }, NOW),
    ).toMatchObject({
      from: '2026-09-15',
      to: '2026-09-15',
    });
  });

  it('gộp cả bốn param cùng lúc', () => {
    expect(
      parseBookingsSearchParams(
        { ...ALL, page: '4', status: 'REFUNDED', q: 'ann', limit: '10' },
        NOW,
      ),
    ).toEqual({
      page: 4,
      limit: 10,
      ...NO_DATES,
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

  it('chuỗi rỗng (ô date bị xoá trắng) cũng là xoá — và cũng phát cờ dates=all như null', () => {
    expect(bookingsHref({ ...base, from: '2026-09-01' }, { from: '' })).toBe('/bookings?dates=all');
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

/**
 * Chọn hàng để export (01/09). Ràng buộc nền: phân trang là điều hướng THẬT
 * nên tích không sống qua trang — việc chọn khoá trong trang đang xem. Nhờ đó
 * `page`+`limit` chính là phạm vi của tập đã tích, và route chỉ cần lấy đúng
 * một trang rồi giao theo mã.
 */
describe('bookingsExportHref — chọn hàng', () => {
  it('không chọn gì: URL như cũ — cả tập đang lọc, KHÔNG mang page/limit', () => {
    const href = bookingsExportHref({ page: 3, limit: 20, status: 'PAID' });

    expect(href).toBe('/bookings/export?status=PAID');
  });

  it('có chọn: mang page+limit+sel để route khoanh đúng trang đang xem', () => {
    const href = bookingsExportHref({ page: 3, limit: 20, status: 'PAID' }, ['BK-A', 'BK-B']);

    expect(href).toBe('/bookings/export?status=PAID&page=3&limit=20&sel=BK-A%2CBK-B');
  });

  it('mảng chọn RỖNG cũng là "không chọn gì" — đừng đẻ ra một sel= trống', () => {
    expect(bookingsExportHref({ page: 1, limit: 20 }, [])).toBe('/bookings/export');
  });
});

/**
 * Mặc định khoảng ngày = THÁNG HIỆN TẠI (user chốt 04/09). Trước đó URL trần
 * hiện mọi booking từ đầu thời gian — một tập lớn dần vô hạn.
 *
 * Mặc định đặt ở TẦNG PARSE chứ không ở hàm dựng href, và đây là bài học F10
 * subscribers trả giá rồi: bản đầu chỉ đặt mặc định lúc điều hướng, nên URL
 * trần từ bookmark rơi về "tất cả" và nút Export dựng ra một file khác hẳn
 * cái đang thấy trên màn hình. Ở đây trang và route export gọi CÙNG hàm này,
 * nên không có đường nào lệch được.
 */
describe('parseBookingsSearchParams — mặc định tháng hiện tại', () => {
  // 4 tháng 9 — đúng ví dụ user đưa.
  const SEP = new Date('2026-09-04T10:00:00.000Z');

  it('URL trần → 1 đến 30 tháng 9', () => {
    const query = parseBookingsSearchParams({}, SEP);

    expect(query.from).toBe('2026-09-01');
    expect(query.to).toBe('2026-09-30');
    expect(query.allDates).toBeUndefined();
  });

  it('ngày cuối tháng tính đúng cho tháng 31 ngày và tháng 2 nhuận', () => {
    // Số ngày lấy từ phép tính lịch, không phải bảng chép tay.
    expect(parseBookingsSearchParams({}, new Date('2026-10-14T00:00:00.000Z')).to).toBe(
      '2026-10-31',
    );
    expect(parseBookingsSearchParams({}, new Date('2028-02-09T00:00:00.000Z')).to).toBe(
      '2028-02-29',
    );
    expect(parseBookingsSearchParams({}, new Date('2026-02-09T00:00:00.000Z')).to).toBe(
      '2026-02-28',
    );
  });

  it('ngày người dùng tự chọn THẮNG mặc định', () => {
    const query = parseBookingsSearchParams({ from: '2026-07-01', to: '2026-07-31' }, SEP);

    expect(query.from).toBe('2026-07-01');
    expect(query.to).toBe('2026-07-31');
  });

  it('chỉ một đầu cũng là người dùng tự chọn — KHÔNG độn nốt đầu kia', () => {
    // Độn thêm `to` là lặng lẽ thu hẹp thứ người ta vừa yêu cầu.
    const query = parseBookingsSearchParams({ from: '2026-07-01' }, SEP);

    expect(query.from).toBe('2026-07-01');
    expect(query.to).toBeUndefined();
  });

  it('`?dates=all` → KHÔNG lọc ngày, và nói rõ đó là cố ý', () => {
    const query = parseBookingsSearchParams({ dates: 'all' }, SEP);

    expect(query.from).toBeUndefined();
    expect(query.to).toBeUndefined();
    // Cờ này là thứ phân biệt "cố ý bỏ lọc" với "URL trần" — thiếu nó thì
    // href dựng lại sẽ độn mặc định vào và không ai về được All.
    expect(query.allDates).toBe(true);
  });

  it('`dates` rác rơi về mặc định, không phải về All', () => {
    // Rơi về All là mở toang tập dữ liệu vì một ký tự gõ nhầm.
    const query = parseBookingsSearchParams({ dates: 'ALL_THE_THINGS' }, SEP);

    expect(query.from).toBe('2026-09-01');
    expect(query.allDates).toBeUndefined();
  });

  it('`?dates=all` mà vẫn kèm ngày thì NGÀY thắng — cái cụ thể hơn thắng', () => {
    const query = parseBookingsSearchParams(
      { dates: 'all', from: '2026-07-01', to: '2026-07-31' },
      SEP,
    );

    expect(query.from).toBe('2026-07-01');
    expect(query.allDates).toBeUndefined();
  });
});

describe('bookingsHref — đường về All', () => {
  const SEP = new Date('2026-09-04T10:00:00.000Z');

  it('xoá TRỐNG cả hai ô ngày thì URL mang `dates=all`, không phải URL trần', () => {
    // URL trần sẽ bị parse độn lại mặc định — ô ngày nảy về tháng này ngay
    // sau khi người dùng vừa xoá nó. Đây đúng là cái bẫy phải chặn.
    const query = parseBookingsSearchParams({}, SEP);
    const href = bookingsHref(query, { from: null, to: null });

    expect(href).toContain('dates=all');
    expect(href).not.toContain('from=');
    expect(parseBookingsSearchParams(searchParamsOf(href), SEP).allDates).toBe(true);
  });

  it('chỉ xoá MỘT đầu thì vẫn là lọc ngày, không nhảy sang All', () => {
    const query = parseBookingsSearchParams({}, SEP);
    const href = bookingsHref(query, { to: null });

    expect(href).toContain('from=2026-09-01');
    expect(href).not.toContain('dates=all');
  });

  it('đang ở All mà chọn một ngày thì thoát All', () => {
    const query = parseBookingsSearchParams({ dates: 'all' }, SEP);
    const href = bookingsHref(query, { from: '2026-07-01' });

    expect(href).toContain('from=2026-07-01');
    expect(href).not.toContain('dates=all');
  });
});

describe('bookingsExportHref — file phải khớp cái đang thấy', () => {
  const SEP = new Date('2026-09-04T10:00:00.000Z');

  it('mang theo khoảng ngày mặc định — không lặng lẽ xuất cả tập', () => {
    const href = bookingsExportHref(parseBookingsSearchParams({}, SEP));

    expect(href).toContain('from=2026-09-01');
    expect(href).toContain('to=2026-09-30');
  });

  it('ở chế độ All thì mang `dates=all` để route hiểu là cố ý', () => {
    const href = bookingsExportHref(parseBookingsSearchParams({ dates: 'all' }, SEP));

    expect(href).toContain('dates=all');
  });
});

/**
 * Vòng đi–về giữa bảng và trang chi tiết (user báo 04/09): bấm một mã booking
 * rồi bấm "Back to bookings" phải quay lại ĐÚNG bộ lọc vừa rời, không nhả
 * filter.
 */
describe('vòng đi–về bảng ↔ chi tiết', () => {
  const SEP = new Date('2026-09-04T10:00:00.000Z');

  describe('bookingDetailHref', () => {
    it('mang trọn bộ lọc và trang hiện tại sang link chi tiết', () => {
      const query = parseBookingsSearchParams(
        { status: 'PAID', q: 'ada', from: '2026-07-01', to: '2026-07-31', page: '3', limit: '50' },
        SEP,
      );
      const href = bookingDetailHref(query, 'BK-4RTG57J3');

      expect(href.startsWith('/bookings/BK-4RTG57J3?')).toBe(true);
      expect(searchParamsOf(href)).toEqual({
        status: 'PAID',
        q: 'ada',
        from: '2026-07-01',
        to: '2026-07-31',
        page: '3',
        limit: '50',
      });
    });

    it('mặc định tháng này cũng được viết RA — link chi tiết không dựa vào phép độn', () => {
      const href = bookingDetailHref(parseBookingsSearchParams({}, SEP), 'BK-1');
      expect(searchParamsOf(href)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    });

    it('chế độ All mang `dates=all` để lượt quay về không bị độn lại tháng này', () => {
      const href = bookingDetailHref(parseBookingsSearchParams({ dates: 'all' }, SEP), 'BK-1');
      expect(searchParamsOf(href)).toEqual({ dates: 'all' });
    });
  });

  describe('bookingsBackHref', () => {
    it('dựng lại ĐÚNG URL danh sách đã rời', () => {
      const query = parseBookingsSearchParams(
        { status: 'PAID', from: '2026-07-01', to: '2026-07-31', page: '3' },
        SEP,
      );
      const back = bookingsBackHref(searchParamsOf(bookingDetailHref(query, 'BK-1')), SEP);

      expect(searchParamsOf(back)).toEqual({
        status: 'PAID',
        from: '2026-07-01',
        to: '2026-07-31',
        page: '3',
      });
    });

    it('giữ chế độ All khi đó là thứ vừa rời', () => {
      const query = parseBookingsSearchParams({ dates: 'all' }, SEP);
      const back = bookingsBackHref(searchParamsOf(bookingDetailHref(query, 'BK-1')), SEP);
      expect(searchParamsOf(back)).toEqual({ dates: 'all' });
    });

    it('vào thẳng URL chi tiết (không qua bảng) → xem TẤT CẢ, không độn tháng này', () => {
      // Tới từ `BookingLink` của /payment-events hay /cancellations thì không
      // biết booking thuộc tháng nào; URL trần bị độn tháng hiện tại và
      // booking tháng trước biến khỏi bảng ngay khi bấm Back (vòng vá 05/09).
      expect(bookingsBackHref({}, SEP)).toBe('/bookings?dates=all');
    });

    it('tham số rác trên URL chi tiết không đẻ ra một href hỏng', () => {
      // Cùng luật khoan dung với đường đọc: rác rơi về mặc định, không ném
      // lên URL để rồi 400 ở server.
      const back = bookingsBackHref({ status: 'NOPE', from: '2026-02-31', page: '-2' }, SEP);
      expect(searchParamsOf(back)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    });
  });
});

/** `?a=1&b=2` của một href → shape mà hàm parse nhận. */
function searchParamsOf(href: string): Record<string, string> {
  const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  return Object.fromEntries(new URLSearchParams(query));
}
