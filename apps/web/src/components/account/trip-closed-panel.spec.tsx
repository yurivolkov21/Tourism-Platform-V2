import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { bookingView } from '@/lib/booking-vm';
import { makeBooking } from '@/test/fixtures/booking';
import { TripClosedPanel } from './trip-closed-panel';

const CANCELLED = makeBooking({
  status: 'CANCELLED',
  paidAt: '2026-08-15T03:05:00.000Z',
  cancelledAt: '2026-09-21T02:00:00.000Z',
  refundedTotal: '147.00',
  totalAmount: '147.00',
});

function renderClosed(booking: BookingDetail, kind: 'cancelled' | 'lapsed' = 'cancelled') {
  return render(
    <TripClosedPanel
      booking={booking}
      view={bookingView(booking, booking.cancellation)}
      kind={kind}
    />,
  );
}

describe('TripClosedPanel — đã huỷ', () => {
  it('h2 "Cancelled", câu kết thúc, chữ hoàn đủ và thời gian về tài khoản, Browse tours', () => {
    renderClosed(CANCELLED);
    expect(screen.getByRole('heading', { level: 2, name: 'Cancelled' })).toBeInTheDocument();
    expect(screen.getByText('This booking was cancelled.')).toBeInTheDocument();
    expect(
      screen.getByText('$147.00 has been refunded to your original payment method.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('It can take 5–10 business days to appear on your statement.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
  });

  it('hoàn một phần: nói cả hai số', () => {
    renderClosed({ ...CANCELLED, refundedTotal: '73.50' });
    expect(
      screen.getByText('$73.50 of $147.00 has been refunded to your original payment method.'),
    ).toBeInTheDocument();
  });

  it('huỷ mà không hoàn đồng nào: nói ra, kèm link chính sách thay cho câu thời gian', () => {
    renderClosed({ ...CANCELLED, refundedTotal: '0.00' });
    expect(screen.getByText('No refund was due on this booking.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('đơn chưa từng thu tiền: không câu hoàn tiền nào', () => {
    renderClosed({ ...CANCELLED, paidAt: null, refundedTotal: '0.00' });
    expect(screen.queryByText('No refund was due on this booking.')).toBeNull();
    expect(
      screen.queryByText('It can take 5–10 business days to appear on your statement.'),
    ).toBeNull();
  });

  it('bị thu rồi hoàn tự động trước khi sang PAID (paidAt null): vẫn kể khoản hoàn', () => {
    // Thua đua ghế hay chuyến đóng lúc capture về — API không ghi `paid_at` (review P7 B1).
    renderClosed({ ...CANCELLED, paidAt: null });
    expect(
      screen.getByText('$147.00 has been refunded to your original payment method.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('It can take 5–10 business days to appear on your statement.'),
    ).toBeInTheDocument();
  });

  it('REFUNDED: câu kết thúc của trạng thái ấy', () => {
    renderClosed({ ...CANCELLED, status: 'REFUNDED' });
    expect(screen.getByText('This booking was refunded.')).toBeInTheDocument();
  });

  it('yêu cầu huỷ của luồng cũ còn trên dữ liệu: kể lại sự việc', () => {
    renderClosed({
      ...CANCELLED,
      cancellationStatus: 'DENIED',
      cancellationRequestedAt: '2026-09-19T08:00:00.000Z',
    });
    expect(
      screen.getByText('Your cancellation request of 19 Sep 2026 was declined.'),
    ).toBeInTheDocument();
  });
});

describe('TripClosedPanel — giữ chỗ không trả kịp', () => {
  it('h2 "Payment not completed", câu giải thích, Browse tours', () => {
    renderClosed(
      makeBooking({ status: 'PENDING', paidAt: null, departureStartDate: '2026-10-01' }),
      'lapsed',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Payment not completed' }),
    ).toBeInTheDocument();
    expect(screen.getByText('This booking wasn’t paid in time.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
  });
});
