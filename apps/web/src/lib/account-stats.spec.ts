import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { dashboardStats, nextTrip, upcomingBookings } from './account-stats';

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
