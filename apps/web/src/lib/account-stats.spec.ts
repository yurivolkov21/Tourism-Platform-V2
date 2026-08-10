import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  dashboardStats,
  daysUntilDeparture,
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
