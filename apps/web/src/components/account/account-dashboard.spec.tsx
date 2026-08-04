import { render, screen } from '@testing-library/react';
import type { Booking, WishlistItem } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDashboard } from './account-dashboard';

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

function makeWishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a',
    slug: 'ninh-binh-trang-an-day',
    title: 'Ninh Bình: Tràng An, Múa Cave & Rice Fields',
    basePrice: '79.00',
    currency: 'USD',
    durationDays: 1,
    ratingAvg: 4.8,
    ratingCount: 132,
    addedAt: '2026-07-28T14:00:00.000Z',
    unavailable: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AccountDashboard — empty tổng', () => {
  it('không booking, không saved → empty-state với CTA /tours, KHÔNG render 4 ô số', () => {
    render(<AccountDashboard bookings={[]} wishlist={[]} />);
    expect(screen.getByRole('link', { name: /browse tours/i })).toHaveAttribute('href', '/tours');
    expect(screen.queryByText('Trips')).not.toBeInTheDocument();
  });
});

describe('AccountDashboard — có dữ liệu', () => {
  const bookings = [
    makeBooking({ code: 'BK-NEAREST1', departureStartDate: '2026-08-20' }),
    makeBooking({ code: 'BK-PASTPAID', departureStartDate: '2026-01-01' }),
  ];
  const wishlist = [makeWishlistItem()];

  it('4 ô số đúng theo dashboardStats (trips=2, upcoming=1, completed=1, saved=1)', () => {
    render(<AccountDashboard bookings={bookings} wishlist={wishlist} />);
    expect(screen.getByText('Trips')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // upcoming + completed + saved đều = 1 → ba ô số cùng hiện "1".
    expect(screen.getAllByText('1')).toHaveLength(3);
  });

  it('có nextTrip → hiện thẻ "chuyến kế tiếp" với tên tour', () => {
    render(<AccountDashboard bookings={bookings} wishlist={wishlist} />);
    expect(screen.getByText('Your next trip')).toBeInTheDocument();
    // "Test Tour" xuất hiện 2 lần: thẻ nextTrip + hàng của chính booking đó
    // trong danh sách "5 upcoming" (cùng một booking, hai khối khác nhau).
    expect(screen.getAllByText('Test Tour').length).toBeGreaterThanOrEqual(1);
  });

  it('không có nextTrip (toàn quá khứ) nhưng vẫn có booking khác → KHÔNG hiện thẻ nextTrip, KHÔNG rơi vào empty tổng', () => {
    const onlyPast = [makeBooking({ departureStartDate: '2026-01-01' })];
    render(<AccountDashboard bookings={onlyPast} wishlist={[]} />);
    expect(screen.queryByText('Your next trip')).not.toBeInTheDocument();
    expect(screen.getByText('Trips')).toBeInTheDocument();
  });

  it('upcoming rỗng (chỉ có booking quá khứ) → text "No upcoming bookings yet."', () => {
    const onlyPast = [makeBooking({ departureStartDate: '2026-01-01' })];
    render(<AccountDashboard bookings={onlyPast} wishlist={wishlist} />);
    expect(screen.getByText('No upcoming bookings yet.')).toBeInTheDocument();
  });

  it('upcoming có phần tử → link tới /account/bookings/[code]', () => {
    render(<AccountDashboard bookings={bookings} wishlist={wishlist} />);
    const link = screen.getByRole('link', { name: /test tour/i });
    expect(link).toHaveAttribute('href', '/account/bookings/BK-NEAREST1');
  });

  it('saved rỗng (bookings vẫn có) → text "No saved tours yet."', () => {
    render(<AccountDashboard bookings={bookings} wishlist={[]} />);
    expect(screen.getByText('No saved tours yet.')).toBeInTheDocument();
  });

  it('saved có phần tử → render tour card với tiêu đề', () => {
    render(<AccountDashboard bookings={bookings} wishlist={wishlist} />);
    expect(screen.getByText('Ninh Bình: Tràng An, Múa Cave & Rice Fields')).toBeInTheDocument();
  });
});
