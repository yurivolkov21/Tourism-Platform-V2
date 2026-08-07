import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingCard } from './booking-card';

describe('BookingCard', () => {
  it('render tiêu đề tour + tổng tiền + link tới trang detail', () => {
    render(<BookingCard booking={makeBooking({ status: 'PENDING', paidAt: null })} />);
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
    render(
      <BookingCard
        booking={makeBooking({ status: 'PENDING', paidAt: null, numAdults: 2, numChildren: 1 })}
      />,
    );
    expect(screen.getByText(/2 adults, 1 child/)).toBeInTheDocument();
  });
});
