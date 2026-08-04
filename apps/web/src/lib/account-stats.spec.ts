import type { Booking } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardStats, nextTrip } from './account-stats';

const TODAY = '2026-08-04';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b0000000-0000-4000-8000-000000000000',
    code: 'BK-TESTAAAA',
    status: 'PAID',
    tourTitle: 'Test Tour',
    departureStartDate: '2026-09-01',
    departureEndDate: '2026-09-02',
    unitPrice: '10.00',
    totalAmount: '10.00',
    currency: 'USD',
    numAdults: 1,
    numChildren: 0,
    contactName: 'Test Traveller',
    contactEmail: 'test@example.com',
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-07-01T00:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

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
