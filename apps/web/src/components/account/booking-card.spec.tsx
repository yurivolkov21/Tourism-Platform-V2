import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('KHÔNG còn nhãn "View details" — cả dòng đã là link, nói lại chỉ tốn chỗ', () => {
    render(<BookingCard booking={makeBooking()} />);
    expect(screen.queryByText(/view details/i)).not.toBeInTheDocument();
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

describe('BookingCard — gợi ý ngày kết thúc (chỉ nhóm "đang đi")', () => {
  const TODAY = '2026-08-04';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('MẶC ĐỊNH không hiện — ở nhóm khác nó gây hiểu nhầm', () => {
    // Chuyến chưa khởi hành mà ghi "ends in 3 days" thì người đọc tưởng sắp
    // hết hạn thứ gì đó.
    render(<BookingCard booking={makeBooking({ departureEndDate: '2026-08-07' })} />);
    expect(screen.queryByText(/ends in/)).not.toBeInTheDocument();
  });

  it('bật cờ → "ends in N days"', () => {
    render(<BookingCard booking={makeBooking({ departureEndDate: '2026-08-07' })} showEndsHint />);
    expect(screen.getByText(/ends in 3 days/)).toBeInTheDocument();
  });

  it('kết thúc hôm nay và ngày mai có câu riêng', () => {
    const { unmount } = render(
      <BookingCard booking={makeBooking({ departureEndDate: TODAY })} showEndsHint />,
    );
    expect(screen.getByText(/ends today/)).toBeInTheDocument();
    unmount();
    render(<BookingCard booking={makeBooking({ departureEndDate: '2026-08-05' })} showEndsHint />);
    expect(screen.getByText(/ends tomorrow/)).toBeInTheDocument();
  });
});
