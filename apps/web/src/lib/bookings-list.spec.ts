import { describe, expect, it } from 'vitest';
import {
  BOOKINGS_LIST_LIMIT,
  type BookingsListParams,
  bookingsListApiInput,
  bookingsListHref,
  bookingsListParams,
  EMPTY_BOOKINGS_LIST_PARAMS,
  hasListFilters,
  pagerView,
  searchTermOf,
  toggleValue,
} from './bookings-list';

/**
 * Trạng thái của My bookings nằm trọn trên URL (spec P7 §2.7, §7.4). Mọi ca so TRỌN chuỗi —
 * URL là thứ khách chia sẻ và bấm Back, lệch một ký tự là một trang khác.
 */
describe('bookingsListParams — đọc URL', () => {
  it('URL trống: không lọc, trang 1', () => {
    expect(bookingsListParams({})).toEqual({ q: null, when: [], status: [], page: 1 });
  });

  it('đọc đủ bốn tham số; when và status về thứ tự chuẩn, viết hoa như contract', () => {
    expect(
      bookingsListParams({
        q: '  ha noi ',
        when: 'past,on_tour',
        status: 'refunded,paid',
        page: '2',
      }),
    ).toEqual({ q: 'ha noi', when: ['ON_TOUR', 'PAST'], status: ['PAID', 'REFUNDED'], page: 2 });
  });

  it('giá trị lạ bị bỏ qua, giá trị trùng gộp một', () => {
    expect(bookingsListParams({ when: 'someday,upcoming,upcoming', status: 'paid,lost' })).toEqual({
      q: null,
      when: ['UPCOMING'],
      status: ['PAID'],
      page: 1,
    });
  });

  it('khoá lặp lại (Next trả mảng): danh sách nối lại, giá trị đơn lấy cái đầu', () => {
    expect(bookingsListParams({ when: ['upcoming', 'past'], q: ['hue', 'hoi an'] })).toEqual({
      q: 'hue',
      when: ['UPCOMING', 'PAST'],
      status: [],
      page: 1,
    });
  });

  it.each(['0', '-1', '1.5', 'abc', '10001', ''])('page=%j không hợp lệ thì về 1', (page) => {
    expect(bookingsListParams({ page }).page).toBe(1);
  });

  it('page=10000 là trần contract, còn nhận', () => {
    expect(bookingsListParams({ page: '10000' }).page).toBe(10_000);
  });
});

describe('searchTermOf', () => {
  it.each([
    ['  ha noi  ', 'ha noi'],
    ['   ', null],
    ['', null],
  ])('%j → %j', (text, term) => {
    expect(searchTermOf(text)).toBe(term);
  });

  it('cắt còn 80 ký tự RỒI mới cắt khoảng trắng đuôi', () => {
    expect(searchTermOf(`${'x'.repeat(79)} yz`)).toBe('x'.repeat(79));
  });
});

describe('toggleValue / hasListFilters', () => {
  it('chưa có thì thêm, có rồi thì bỏ; mảng gốc không đổi', () => {
    const list = ['PAID', 'CANCELLED'];
    expect(toggleValue(list, 'REFUNDED')).toEqual(['PAID', 'CANCELLED', 'REFUNDED']);
    expect(toggleValue(list, 'PAID')).toEqual(['CANCELLED']);
    expect(list).toEqual(['PAID', 'CANCELLED']);
  });

  const cases: Array<[Partial<BookingsListParams>, boolean]> = [
    [{}, false],
    [{ page: 3 }, false],
    [{ q: 'hue' }, true],
    [{ when: ['PAST'] }, true],
    [{ status: ['PAID'] }, true],
  ];
  it.each(cases)('hasListFilters(%j) = %s', (patch, expected) => {
    expect(hasListFilters({ ...EMPTY_BOOKINGS_LIST_PARAMS, ...patch })).toBe(expected);
  });
});

describe('bookingsListHref — dựng lại URL', () => {
  it('không lọc, trang 1: đường dẫn trần', () => {
    expect(bookingsListHref(EMPTY_BOOKINGS_LIST_PARAMS)).toBe('/account/bookings');
  });

  it('khoá theo thứ tự q, when, status, page; giá trị viết thường theo thứ tự chuẩn', () => {
    expect(
      bookingsListHref({
        q: 'ha noi',
        when: ['PAST', 'UPCOMING'],
        status: ['PARTIALLY_REFUNDED', 'PAID'],
        page: 2,
      }),
    ).toBe('/account/bookings?q=ha+noi&when=upcoming,past&status=paid,partially_refunded&page=2');
  });

  it('khứ hồi: đọc lại URL vừa dựng ra đúng bộ tham số, kể cả dấu phẩy trong từ khoá', () => {
    const params: BookingsListParams = {
      q: 'Hà Nội, Huế',
      when: ['ON_TOUR'],
      status: ['CANCELLED'],
      page: 3,
    };
    const search = new URLSearchParams(bookingsListHref(params).split('?')[1]);
    expect(bookingsListParams(Object.fromEntries(search))).toEqual(params);
  });
});

describe('bookingsListApiInput — URL sang input của bookings.mine', () => {
  it('luôn journey, 10 dòng; không gửi khoá rỗng', () => {
    expect(bookingsListApiInput(EMPTY_BOOKINGS_LIST_PARAMS)).toEqual({
      page: 1,
      limit: 10,
      order: 'journey',
    });
  });

  it('mang đủ bộ lọc; status luôn là mảng', () => {
    expect(
      bookingsListApiInput({ q: 'hue', when: ['UPCOMING'], status: ['PAID'], page: 3 }),
    ).toEqual({
      page: 3,
      limit: BOOKINGS_LIST_LIMIT,
      order: 'journey',
      when: ['UPCOMING'],
      status: ['PAID'],
      q: 'hue',
    });
  });
});

describe('pagerView — "Previous / Next" (spec §7.4)', () => {
  const FILTERED: BookingsListParams = { q: null, when: ['UPCOMING'], status: [], page: 1 };

  it('một trang hay không trang nào thì không có thanh phân trang', () => {
    expect(pagerView(FILTERED, 1, 7, 10)).toBeNull();
    expect(pagerView(FILTERED, 0, 0, 10)).toBeNull();
  });

  it('trang đầu: không có Previous; Next sang trang 2, giữ bộ lọc', () => {
    expect(pagerView(FILTERED, 2, 18, 10)).toEqual({
      summary: 'Page 1 of 2 · trips 1–10 of 18',
      previousHref: null,
      next: { href: '/account/bookings?when=upcoming&page=2', range: 'Trips 11–18' },
    });
  });

  it('trang giữa: Previous về trang 1 — URL không mang page=1', () => {
    expect(pagerView({ ...FILTERED, page: 2 }, 3, 25, 10)).toEqual({
      summary: 'Page 2 of 3 · trips 11–20 of 25',
      previousHref: '/account/bookings?when=upcoming',
      next: { href: '/account/bookings?when=upcoming&page=3', range: 'Trips 21–25' },
    });
  });

  it('trang cuối: không có Next; trang chỉ một đơn thì nói số ít', () => {
    expect(pagerView({ ...FILTERED, page: 3 }, 3, 21, 10)).toEqual({
      summary: 'Page 3 of 3 · trip 21 of 21',
      previousHref: '/account/bookings?when=upcoming&page=2',
      next: null,
    });
  });

  it('trang kế chỉ còn một đơn: "Trip 11"', () => {
    expect(pagerView(FILTERED, 2, 11, 10)?.next?.range).toBe('Trip 11');
  });
});
