import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  dashboardStats,
  daysUntilDeparture,
  groupBookingsByTime,
  nextTrip,
  recentBookings,
  upcomingBookings,
} from './account-stats';

const TODAY = '2026-08-04';

// "Hôm nay" cố định để test biên ngày không phụ thuộc giờ chạy CI thật.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dashboardStats', () => {
  it('rỗng → cả 4 ô về 0', () => {
    expect(dashboardStats([], 0)).toEqual({ trips: 0, upcoming: 0, completed: 0, saved: 0 });
  });

  it('toàn PAID quá khứ → completed hết, upcoming = 0', () => {
    const bookings = [
      makeBooking({ departureStartDate: '2026-01-10' }),
      makeBooking({ departureStartDate: '2026-05-20' }),
    ];
    expect(dashboardStats(bookings, 3)).toEqual({
      trips: 2,
      upcoming: 0,
      completed: 2,
      saved: 3,
    });
  });

  it('phần tử biên đúng hôm nay tính là upcoming (chưa khởi hành xong)', () => {
    const bookings = [makeBooking({ departureStartDate: TODAY })];
    expect(dashboardStats(bookings, 0)).toEqual({
      trips: 1,
      upcoming: 1,
      completed: 0,
      saved: 0,
    });
  });

  it('trips luôn bằng upcoming + completed (chỉ đếm PAID)', () => {
    const bookings = [
      makeBooking({ status: 'PENDING', departureStartDate: '2026-09-10' }),
      makeBooking({ status: 'PAID', departureStartDate: '2026-09-10' }),
      makeBooking({ status: 'PAID', departureStartDate: '2026-01-01' }),
      makeBooking({ status: 'CANCELLED', departureStartDate: '2026-01-01' }),
      makeBooking({ status: 'REFUNDED', departureStartDate: '2026-01-01' }),
      makeBooking({ status: 'PARTIALLY_REFUNDED', departureStartDate: '2026-09-10' }),
    ];
    const stats = dashboardStats(bookings, 5);
    expect(stats).toEqual({ trips: 2, upcoming: 1, completed: 1, saved: 5 });
  });
});

describe('nextTrip', () => {
  it('rỗng → null', () => {
    expect(nextTrip([])).toBeNull();
  });

  it('toàn PAID quá khứ → null (không có chuyến sắp tới)', () => {
    const bookings = [
      makeBooking({ departureStartDate: '2026-01-10' }),
      makeBooking({ departureStartDate: '2026-05-20' }),
    ];
    expect(nextTrip(bookings)).toBeNull();
  });

  it('phần tử biên đúng hôm nay được tính là chuyến kế tiếp', () => {
    const boundary = makeBooking({ code: 'BK-BOUNDARY', departureStartDate: TODAY });
    expect(nextTrip([boundary])).toEqual(boundary);
  });

  it('chọn đúng booking PAID sắp tới GẦN NHẤT, bỏ qua status khác dù ngày gần hơn', () => {
    const soonerButPending = makeBooking({
      code: 'BK-PENDSOON',
      status: 'PENDING',
      departureStartDate: '2026-08-05',
    });
    const nearestPaid = makeBooking({ code: 'BK-NEAREST1', departureStartDate: '2026-08-20' });
    const fartherPaid = makeBooking({ code: 'BK-FARTHER1', departureStartDate: '2026-12-01' });
    const pastPaid = makeBooking({ code: 'BK-PASTPAID', departureStartDate: '2026-01-01' });

    expect(nextTrip([soonerButPending, fartherPaid, nearestPaid, pastPaid])).toEqual(nearestPaid);
  });
});

// Task 3 (dashboard tĩnh) — khác mục đích `nextTrip`/`dashboardStats`: dashboard
// cần liệt kê việc CẦN CHÚ Ý (kể cả PENDING chưa trả tiền), không chỉ chuyến đã
// xác nhận PAID.
describe('upcomingBookings', () => {
  it('rỗng → []', () => {
    expect(upcomingBookings([], 5)).toEqual([]);
  });

  it('gồm CẢ PENDING và PAID sắp tới, sắp theo ngày tăng dần', () => {
    const pending = makeBooking({
      code: 'BK-PENDING1',
      status: 'PENDING',
      departureStartDate: '2026-09-10',
    });
    const paidSooner = makeBooking({
      code: 'BK-PAIDSOON',
      status: 'PAID',
      departureStartDate: '2026-08-15',
    });
    expect(upcomingBookings([pending, paidSooner], 5)).toEqual([paidSooner, pending]);
  });

  it('loại CANCELLED/REFUNDED/PARTIALLY_REFUNDED dù ngày tương lai', () => {
    const bookings = [
      makeBooking({ status: 'CANCELLED', departureStartDate: '2026-09-01' }),
      makeBooking({ status: 'REFUNDED', departureStartDate: '2026-09-02' }),
      makeBooking({ status: 'PARTIALLY_REFUNDED', departureStartDate: '2026-09-03' }),
    ];
    expect(upcomingBookings(bookings, 5)).toEqual([]);
  });

  it('loại booking PAID quá khứ', () => {
    const past = makeBooking({ departureStartDate: '2026-01-01' });
    expect(upcomingBookings([past], 5)).toEqual([]);
  });

  it('phần tử biên đúng hôm nay được tính là sắp tới', () => {
    const boundary = makeBooking({ code: 'BK-BOUNDARY', departureStartDate: TODAY });
    expect(upcomingBookings([boundary], 5)).toEqual([boundary]);
  });

  it('cắt đúng limit, giữ N phần tử GẦN NHẤT', () => {
    const a = makeBooking({ code: 'BK-A', departureStartDate: '2026-08-10' });
    const b = makeBooking({ code: 'BK-B', departureStartDate: '2026-08-20' });
    const c = makeBooking({ code: 'BK-C', departureStartDate: '2026-08-30' });
    expect(upcomingBookings([c, a, b], 2)).toEqual([a, b]);
  });
});

describe('recentBookings — dòng thời gian HOẠT ĐỘNG, khác "sắp tới"', () => {
  // `upcomingBookings` trả lời "tôi sắp đi đâu"; hàm này trả lời "tôi vừa làm
  // gì". Hai câu hỏi khác nhau nên phép chọn cũng khác: ở đây KHÔNG lọc theo
  // trạng thái và KHÔNG lọc theo ngày khởi hành.
  const at = (createdAt: string, over = {}) =>
    makeBooking({ createdAt: `${createdAt}T00:00:00.000Z`, ...over });

  it('rỗng → mảng rỗng, không ném', () => {
    expect(recentBookings([], 5)).toEqual([]);
  });

  it('GIỮ booking CANCELLED — đây là điểm khác upcomingBookings', () => {
    const cancelled = at('2026-08-03', { status: 'CANCELLED' as const, code: 'BK-CANCEL01' });
    expect(recentBookings([cancelled], 5).map((b) => b.code)).toEqual(['BK-CANCEL01']);
    // Đối chứng: phép chọn cũ loại nó.
    expect(upcomingBookings([cancelled], 5)).toEqual([]);
  });

  it('GIỮ chuyến đã đi qua — "gần đây" nói về lúc ĐẶT, không phải lúc đi', () => {
    const past = at('2026-08-01', { departureStartDate: '2026-01-05', code: 'BK-PAST0001' });
    expect(recentBookings([past], 5).map((b) => b.code)).toEqual(['BK-PAST0001']);
    expect(upcomingBookings([past], 5)).toEqual([]);
  });

  it('sắp theo createdAt GIẢM DẦN, không theo ngày khởi hành', () => {
    // Bẫy thật: booking đặt sau có thể khởi hành trước. Sắp nhầm trục là
    // "gần đây" hiện ra thứ tự vô nghĩa với khách.
    const older = at('2026-07-01', { code: 'BK-OLDER001', departureStartDate: '2026-01-01' });
    const newer = at('2026-08-05', { code: 'BK-NEWER001', departureStartDate: '2026-12-31' });
    expect(recentBookings([older, newer], 5).map((b) => b.code)).toEqual([
      'BK-NEWER001',
      'BK-OLDER001',
    ]);
  });

  it('cắt đúng limit', () => {
    const many = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'].map((d, i) =>
      at(d, { code: `BK-000000P${i}` }),
    );
    expect(recentBookings(many, 2)).toHaveLength(2);
    expect(recentBookings(many, 0)).toEqual([]);
  });

  it('KHÔNG sửa mảng gốc — hàm thuần', () => {
    const input = [
      at('2026-07-01', { code: 'BK-AAAAAAA1' }),
      at('2026-08-01', { code: 'BK-BBBBBBB1' }),
    ];
    const before = input.map((b) => b.code);
    recentBookings(input, 5);
    expect(input.map((b) => b.code)).toEqual(before);
  });

  it('createdAt bằng nhau → thứ tự TẤT ĐỊNH theo code, không phụ thuộc thứ tự vào', () => {
    const a = at('2026-08-01', { code: 'BK-AAAAAAAA' });
    const b = at('2026-08-01', { code: 'BK-BBBBBBBB' });
    expect(recentBookings([a, b], 5).map((x) => x.code)).toEqual(
      recentBookings([b, a], 5).map((x) => x.code),
    );
  });
});

describe('daysUntilDeparture — đồng hồ đếm ngược trên thẻ chuyến kế tiếp', () => {
  it('khởi hành hôm nay → 0, KHÔNG âm', () => {
    expect(daysUntilDeparture(TODAY)).toBe(0);
  });

  it('ngày mai → 1', () => {
    expect(daysUntilDeparture('2026-08-05')).toBe(1);
  });

  it('đếm đúng qua ranh giới THÁNG', () => {
    // 04/08 → 01/09 là 28 ngày. Trừ chuỗi ngày kiểu ngây thơ sẽ ra sai ở đây.
    expect(daysUntilDeparture('2026-09-01')).toBe(28);
  });

  it('chuyến đã qua → số ÂM, để chỗ gọi tự quyết hiển thị gì', () => {
    expect(daysUntilDeparture('2026-08-01')).toBe(-3);
  });

  it('KHÔNG lệch vì múi giờ — so theo ngày lịch UTC, không theo giờ máy', () => {
    // Chạy lúc 12:00 UTC (beforeEach). Nếu hàm dùng giờ địa phương của máy
    // thì một máy ở UTC+7 sẽ cho lệch một ngày ở các mốc gần nửa đêm.
    vi.setSystemTime(new Date(`${TODAY}T23:59:59.000Z`));
    expect(daysUntilDeparture('2026-08-05')).toBe(1);
    vi.setSystemTime(new Date(`${TODAY}T00:00:01.000Z`));
    expect(daysUntilDeparture('2026-08-05')).toBe(1);
  });
});

describe('groupBookingsByTime — ba nhóm của /account/bookings', () => {
  const trip = (code: string, start: string, end: string, over = {}) =>
    makeBooking({ code, departureStartDate: start, departureEndDate: end, ...over });

  it('rỗng → ba nhóm rỗng, không ném', () => {
    expect(groupBookingsByTime([])).toEqual({ onTheRoad: [], upcoming: [], past: [] });
  });

  it('đang đi: hôm nay NẰM TRONG khoảng khởi hành, và đã trả tiền', () => {
    const now = trip('BK-ONROAD01', '2026-08-02', '2026-08-06');
    expect(groupBookingsByTime([now]).onTheRoad.map((b) => b.code)).toEqual(['BK-ONROAD01']);
  });

  it('ngày bắt đầu và ngày kết thúc đều TÍNH LÀ đang đi — biên đóng hai đầu', () => {
    // Chuyến khởi hành đúng hôm nay chưa thể là "sắp tới"; chuyến kết thúc
    // đúng hôm nay chưa thể là "đã qua".
    expect(groupBookingsByTime([trip('BK-STARTTOD', TODAY, '2026-08-09')]).onTheRoad).toHaveLength(
      1,
    );
    expect(groupBookingsByTime([trip('BK-ENDSTODA', '2026-08-01', TODAY)]).onTheRoad).toHaveLength(
      1,
    );
  });

  it('CANCELLED luôn vào "đã qua", kể cả khi ngày còn ở tương lai', () => {
    // Nói một chuyến đã huỷ là "sắp tới" thì đang hứa thứ không xảy ra.
    const cancelled = trip('BK-CANCEL01', '2026-12-01', '2026-12-05', {
      status: 'CANCELLED' as const,
    });
    const g = groupBookingsByTime([cancelled]);
    expect(g.past.map((b) => b.code)).toEqual(['BK-CANCEL01']);
    expect(g.upcoming).toEqual([]);
  });

  it('CHƯA trả tiền mà ngày đã tới → "sắp tới", KHÔNG phải "đang đi"', () => {
    // PENDING không giữ chỗ (bất biến #1), nên gọi nó là "đang đi" là sai sự
    // thật. Để ở "sắp tới" kèm pill "Awaiting payment" mới đúng mức khẩn.
    const pending = trip('BK-PENDNOW1', '2026-08-02', '2026-08-06', { status: 'PENDING' as const });
    const g = groupBookingsByTime([pending]);
    expect(g.onTheRoad).toEqual([]);
    expect(g.upcoming.map((b) => b.code)).toEqual(['BK-PENDNOW1']);
  });

  it('sắp tới: gần nhất TRƯỚC', () => {
    const far = trip('BK-FAR00001', '2026-12-01', '2026-12-05');
    const near = trip('BK-NEAR0001', '2026-08-20', '2026-08-22');
    expect(groupBookingsByTime([far, near]).upcoming.map((b) => b.code)).toEqual([
      'BK-NEAR0001',
      'BK-FAR00001',
    ]);
  });

  it('đã qua: MỚI NHẤT trước — ngược chiều với sắp tới', () => {
    const old = trip('BK-OLD00001', '2026-01-01', '2026-01-03');
    const recent = trip('BK-RECENT01', '2026-07-01', '2026-07-03');
    expect(groupBookingsByTime([old, recent]).past.map((b) => b.code)).toEqual([
      'BK-RECENT01',
      'BK-OLD00001',
    ]);
  });

  it('KHÔNG làm mất booking nào — tổng ba nhóm bằng đầu vào', () => {
    const all = [
      trip('BK-AAAAAAA1', '2026-08-02', '2026-08-06'),
      trip('BK-BBBBBBB1', '2026-12-01', '2026-12-05'),
      trip('BK-CCCCCCC1', '2026-01-01', '2026-01-03'),
      trip('BK-DDDDDDD1', '2026-12-01', '2026-12-05', { status: 'CANCELLED' as const }),
    ];
    const g = groupBookingsByTime(all);
    expect(g.onTheRoad.length + g.upcoming.length + g.past.length).toBe(all.length);
  });

  it('KHÔNG sửa mảng gốc', () => {
    const input = [
      trip('BK-ZZZZZZZ1', '2026-12-01', '2026-12-05'),
      trip('BK-YYYYYYY1', '2026-08-20', '2026-08-22'),
    ];
    const before = input.map((b) => b.code);
    groupBookingsByTime(input);
    expect(input.map((b) => b.code)).toEqual(before);
  });
});
