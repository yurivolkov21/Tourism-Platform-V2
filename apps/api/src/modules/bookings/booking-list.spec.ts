import {
  type BookingListFilter,
  type BookingListKey,
  matchesSearch,
  searchKey,
  selectBookingsPage,
} from './booking-list.js';

/**
 * Lọc, tìm, xếp, đếm của `bookings.mine` (ADR-0054 §2–3), thuần trên tập khoá nhẹ. Hôm nay
 * cố định 05/10/2026. Bộ đơn dựng sao cho thứ tự hành trình KHÁC mọi thứ tự lười: thứ tự đưa
 * vào, ngày tạo tăng hay giảm, ngày đi tăng hay giảm, và "nhóm rồi theo ngày tạo".
 */
const TODAY = '2026-10-05';
const NOW = Date.parse('2026-10-05T03:00:00.000Z');

/** Một khoá; `id` trùng `code` để kết quả đọc được bằng mắt. */
function key(
  code: string,
  patch: Partial<Omit<BookingListKey, 'createdAt'>> & { minutesAgo: number },
): BookingListKey {
  const { minutesAgo, ...rest } = patch;
  return {
    id: code,
    code,
    status: 'PAID',
    createdAt: new Date(NOW - minutesAgo * 60_000),
    departureStartDate: '2026-11-01',
    departureEndDate: '2026-11-01',
    tourTitle: 'Test Tour',
    destinationNames: [],
    ...rest,
  };
}

/** Tám đơn quanh 05/10 — thứ tự đưa vào cố ý lộn xộn. */
const KEYS: BookingListKey[] = [
  key('BK-AWAITPAY', {
    status: 'PENDING',
    departureStartDate: '2026-10-25',
    departureEndDate: '2026-10-25',
    minutesAgo: 45,
  }),
  key('BK-TRAVELD1', {
    departureStartDate: '2026-09-05',
    departureEndDate: '2026-09-06',
    minutesAgo: 40,
  }),
  key('BK-ONTOUR01', {
    departureStartDate: '2026-10-04',
    departureEndDate: '2026-10-06',
    minutesAgo: 10,
  }),
  // Hoàn đủ mà ngày đi còn ở tương lai: thuộc nhóm ĐÃ QUA (sự thật 3 của ADR-0054).
  key('BK-REFUNDED', {
    status: 'REFUNDED',
    departureStartDate: '2026-10-20',
    departureEndDate: '2026-10-20',
    minutesAgo: 30,
  }),
  key('BK-UPCOMNG1', {
    departureStartDate: '2026-10-15',
    departureEndDate: '2026-10-16',
    minutesAgo: 60,
  }),
  // Chưa trả mà ngày đi đã qua: `lapsed`, nhóm ĐÃ QUA.
  key('BK-LAPSED01', {
    status: 'PENDING',
    departureStartDate: '2026-09-30',
    departureEndDate: '2026-09-30',
    minutesAgo: 90,
  }),
  // Hoàn một phần mà chuyến vẫn đi: đang đi như PAID.
  key('BK-PARTREF1', {
    status: 'PARTIALLY_REFUNDED',
    departureStartDate: '2026-10-03',
    departureEndDate: '2026-10-07',
    minutesAgo: 70,
  }),
  // Cùng ngày đi với UPCOMNG1 nhưng tạo SAU: hoà ngày đi thì đứng trước.
  key('BK-UPCOMNG2', {
    departureStartDate: '2026-10-15',
    departureEndDate: '2026-10-16',
    minutesAgo: 50,
  }),
];

const JOURNEY = [
  'BK-PARTREF1',
  'BK-ONTOUR01',
  'BK-UPCOMNG2',
  'BK-UPCOMNG1',
  'BK-AWAITPAY',
  'BK-REFUNDED',
  'BK-LAPSED01',
  'BK-TRAVELD1',
];
const RECENT = [
  'BK-ONTOUR01',
  'BK-REFUNDED',
  'BK-TRAVELD1',
  'BK-AWAITPAY',
  'BK-UPCOMNG2',
  'BK-UPCOMNG1',
  'BK-PARTREF1',
  'BK-LAPSED01',
];
const FULL_FACETS = {
  when: { ON_TOUR: 2, UPCOMING: 3, PAST: 3 },
  status: { PENDING: 2, PAID: 4, CANCELLED: 0, REFUNDED: 1, PARTIALLY_REFUNDED: 1 },
};

const filter = (patch: Partial<BookingListFilter> = {}): BookingListFilter => ({
  page: 1,
  limit: 50,
  order: 'journey',
  ...patch,
});
const ids = (patch: Partial<BookingListFilter> = {}) =>
  selectBookingsPage(KEYS, filter(patch), TODAY).pageIds;

describe('selectBookingsPage — thứ tự', () => {
  it('journey: đang đi → sắp đi (gồm chờ trả) theo ngày đi tăng → đã qua theo ngày đi giảm', () => {
    expect(ids()).toEqual(JOURNEY);
  });

  it('recent: ngày tạo giảm dần — đúng thứ tự trước ADR-0054', () => {
    expect(ids({ order: 'recent' })).toEqual(RECENT);
  });

  it('hoà cả ngày đi lẫn ngày tạo thì id tăng dần, bất kể thứ tự đọc từ DB', () => {
    const twin = (code: string) =>
      key(code, {
        departureStartDate: '2026-10-15',
        departureEndDate: '2026-10-15',
        minutesAgo: 5,
      });
    const forward = [twin('BK-ZZZZ0001'), twin('BK-AAAA0001')];
    for (const keys of [forward, [...forward].reverse()]) {
      for (const order of ['journey', 'recent'] as const) {
        expect(selectBookingsPage(keys, filter({ order }), TODAY).pageIds).toEqual([
          'BK-AAAA0001',
          'BK-ZZZZ0001',
        ]);
      }
    }
  });
});

describe('selectBookingsPage — cắt trang', () => {
  it('ba trang ba dòng nối lại đúng thứ tự journey, không trùng không sót', () => {
    const pages = [1, 2, 3].map((page) =>
      selectBookingsPage(KEYS, filter({ page, limit: 3 }), TODAY),
    );
    expect(pages.map((result) => result.pageIds)).toEqual([
      JOURNEY.slice(0, 3),
      JOURNEY.slice(3, 6),
      JOURNEY.slice(6),
    ]);
    expect(pages.map((result) => result.total)).toEqual([8, 8, 8]);
  });

  it('trang vượt số trang: không dòng nào, total giữ nguyên', () => {
    const beyond = selectBookingsPage(KEYS, filter({ page: 4, limit: 3 }), TODAY);
    expect(beyond.pageIds).toEqual([]);
    expect(beyond.total).toBe(8);
  });
});

describe('selectBookingsPage — lọc', () => {
  it('when nhiều giá trị là HOẶC', () => {
    expect(ids({ when: ['ON_TOUR', 'UPCOMING'] })).toEqual([
      'BK-PARTREF1',
      'BK-ONTOUR01',
      'BK-UPCOMNG2',
      'BK-UPCOMNG1',
      'BK-AWAITPAY',
    ]);
  });

  it('status nhiều giá trị là HOẶC', () => {
    expect(ids({ status: ['PENDING', 'REFUNDED'] })).toEqual([
      'BK-AWAITPAY',
      'BK-REFUNDED',
      'BK-LAPSED01',
    ]);
  });

  it('status một giá trị (cú pháp cũ `status=PAID`) vẫn lọc', () => {
    expect(ids({ status: 'PAID', order: 'recent' })).toEqual([
      'BK-ONTOUR01',
      'BK-TRAVELD1',
      'BK-UPCOMNG2',
      'BK-UPCOMNG1',
    ]);
  });

  it('hai trục là VÀ: PAST cộng PENDING chỉ còn đơn lỡ hạn', () => {
    expect(ids({ when: ['PAST'], status: ['PENDING'] })).toEqual(['BK-LAPSED01']);
  });
});

describe('selectBookingsPage — đếm', () => {
  it('facets đếm TOÀN BỘ đơn, bỏ qua bộ lọc và từ khoá; overallTotal không lọc', () => {
    const narrow = selectBookingsPage(
      KEYS,
      filter({ when: ['PAST'], status: ['PENDING'], q: 'nothing matches this' }),
      TODAY,
    );
    expect(narrow.total).toBe(0);
    expect(narrow.facets).toEqual(FULL_FACETS);
    expect(narrow.overallTotal).toBe(8);
  });

  it('khách chưa có đơn nào: đủ mọi khoá, toàn số 0', () => {
    expect(selectBookingsPage([], filter(), TODAY)).toEqual({
      pageIds: [],
      total: 0,
      facets: {
        when: { ON_TOUR: 0, UPCOMING: 0, PAST: 0 },
        status: { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
      },
      overallTotal: 0,
    });
  });
});

describe('searchKey / matchesSearch (ADR-0054 §3)', () => {
  it.each([
    ['Hà Nội', 'hanoi'],
    ['Đà Lạt', 'dalat'],
    ['BK-B6VCOQNW', 'bkb6vcoqnw'],
    ['Ninh Bình: Tràng An', 'ninhbinhtrangan'],
  ])('searchKey(%j) = %j', (value, expected) => {
    expect(searchKey(value)).toBe(expected);
  });

  /** Tên tour KHÔNG chứa "Hanoi": khớp "ha noi" chỉ có thể đến từ tên điểm đến. */
  const OLD_QUARTER = key('BK-B6VCOQNW', {
    tourTitle: 'Old Quarter Food Walk',
    destinationNames: ['Hà Nội'],
    minutesAgo: 1,
  });

  it.each(['ha noi', 'hanoi', 'Hà Nội', 'HA NOI'])('tên điểm đến: %j khớp "Hà Nội"', (q) => {
    expect(matchesSearch(OLD_QUARTER, q)).toBe(true);
  });

  it.each(['quarter food', 'FOOD WALK'])('tên tour: %j', (q) => {
    expect(matchesSearch(OLD_QUARTER, q)).toBe(true);
  });

  it.each(['b6vcoqnw', 'BK-B6VC', 'bk b6vc'])('mã đơn có hay không có BK-: %j', (q) => {
    expect(matchesSearch(OLD_QUARTER, q)).toBe(true);
  });

  it.each(['hoi an', 'saigon', '!!!', ' - '])('không khớp: %j', (q) => {
    expect(matchesSearch(OLD_QUARTER, q)).toBe(false);
  });

  it('q lọc trước khi cắt trang; total đếm sau lọc, overallTotal thì không', () => {
    const lantern = key('BK-TRIP0002', {
      tourTitle: 'Hội An Old Town & Lantern Evening',
      destinationNames: ['Hội An'],
      minutesAgo: 2,
    });
    const result = selectBookingsPage([OLD_QUARTER, lantern], filter({ q: 'hoi an' }), TODAY);
    expect(result.pageIds).toEqual(['BK-TRIP0002']);
    expect(result.total).toBe(1);
    expect(result.overallTotal).toBe(2);
  });
});
