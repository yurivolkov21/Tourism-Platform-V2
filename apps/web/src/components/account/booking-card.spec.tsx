import { render, screen } from '@testing-library/react';
import type { Booking } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { BookingCard } from './booking-card';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b0000000-0000-4000-8000-000000000000',
    code: 'BK-TESTAAAA',
    status: 'PENDING',
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
    paidAt: null,
    cancelledAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    // Task 6a (A2): field mới trên BookingSchema, không dùng bởi BookingCard.
    cancellationStatus: null,
    ...overrides,
  };
}

describe('BookingCard', () => {
  it('render tiêu đề tour + tổng tiền + link tới trang detail', () => {
    render(<BookingCard booking={makeBooking()} />);
    expect(screen.getByText('Test Tour')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/account/bookings/BK-TESTAAAA');
  });

  it('badge status PENDING → nhãn "Awaiting payment" (một nguồn booking.list.status) + tone warning', () => {
    render(<BookingCard booking={makeBooking({ status: 'PENDING' })} />);
    const badge = screen.getByText('Awaiting payment');
    expect(badge.className).toContain('text-warning');
  });

  it('badge status PAID → nhãn "Paid" + tone success', () => {
    render(<BookingCard booking={makeBooking({ status: 'PAID' })} />);
    const badge = screen.getByText('Paid');
    expect(badge.className).toContain('text-success');
  });

  it('badge status CANCELLED → nhãn "Cancelled" + tone muted', () => {
    render(<BookingCard booking={makeBooking({ status: 'CANCELLED' })} />);
    const badge = screen.getByText('Cancelled');
    expect(badge.className).toContain('text-muted-foreground');
  });

  it('badge status REFUNDED và PARTIALLY_REFUNDED → cùng tone destructive', () => {
    const { unmount } = render(<BookingCard booking={makeBooking({ status: 'REFUNDED' })} />);
    expect(screen.getByText('Refunded').className).toContain('text-destructive');
    unmount();
    render(<BookingCard booking={makeBooking({ status: 'PARTIALLY_REFUNDED' })} />);
    expect(screen.getByText('Partially refunded').className).toContain('text-destructive');
  });

  it('có trẻ em → travellers hiện cả người lớn và trẻ em', () => {
    render(<BookingCard booking={makeBooking({ numAdults: 2, numChildren: 1 })} />);
    expect(screen.getByText(/2 adults, 1 child/)).toBeInTheDocument();
  });
});
