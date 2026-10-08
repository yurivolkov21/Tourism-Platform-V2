import { render, screen } from '@testing-library/react';
import type { BookingDetail, BookingPhase } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import { bookingView } from '@/lib/booking-vm';
import { makeBooking, makeCancellation } from '@/test/fixtures/booking';
import { BookingDetailsPanel } from './booking-details-panel';

// `BookingActions` (nút huỷ ở hàng đáy) dùng router và client oRPC.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { checkout: vi.fn(), cancelPending: vi.fn(), cancel: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

/** Ngày đặt 13/08 khác ngày trả 14/08 — bắt chỗ đọc nhầm mốc. */
const PAID_TRIP = makeBooking({
  code: 'BK-B6VCOQNW',
  contactName: 'Erik Lund',
  contactEmail: 'erik.lund@example.com',
  contactPhone: '+84 90 123 4567',
  numAdults: 2,
  numChildren: 1,
  unitPrice: '49.00',
  totalAmount: '147.00',
  paymentProvider: 'PAYPAL',
  createdAt: '2026-08-13T10:00:00.000Z',
  paidAt: '2026-08-14T03:05:00.000Z',
  specialRequests: null,
});

/**
 * Cờ server CỐ Ý nói hạn chót (02/11) khác `cancellationDeadline` của đơn (29/08, mặc định của
 * fixture): khối Cancellation phải in ngày của CỜ — đọc nhầm nguồn là chữ ra "29 Aug", ca đỏ.
 */
const CANCELLATION = makeCancellation(PAID_TRIP, { deadline: '2026-11-02' });
const PAID = { ...PAID_TRIP, cancellation: CANCELLATION };

function renderPanel(
  booking: BookingDetail = PAID,
  phase: BookingPhase = 'upcoming',
  meetingPoint: string | null = 'Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ',
) {
  return render(
    <BookingDetailsPanel
      booking={booking}
      view={bookingView(booking, booking.cancellation)}
      phase={phase}
      meetingPoint={meetingPoint}
    />,
  );
}

describe('BookingDetailsPanel — bốn khối (spec §5.3)', () => {
  it('Lead traveller: chữ cái đầu của họ và tên, email, điện thoại', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Lead traveller' })).toBeInTheDocument();
    expect(screen.getByText('EL')).toBeInTheDocument();
    expect(screen.getByText('Erik Lund')).toBeInTheDocument();
    expect(screen.getByText('erik.lund@example.com')).toBeInTheDocument();
    expect(screen.getByText('+84 90 123 4567')).toBeInTheDocument();
  });

  it('chữ cái đầu lấy từ ĐẦU và CUỐI tên; tên một chữ thì một chữ cái', () => {
    renderPanel({ ...PAID, contactName: 'Nguyễn Văn An' });
    expect(screen.getByText('NA')).toBeInTheDocument();
  });

  it('tên một chữ: một chữ cái', () => {
    renderPanel({ ...PAID, contactName: 'Madonna' });
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('Payment: dòng người lớn, trẻ em, "Total paid", ngày trả và chế độ thử', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByText('2 adults')).toBeInTheDocument();
    expect(screen.getByText('$98')).toBeInTheDocument();
    expect(screen.getByText('1 child')).toBeInTheDocument();
    expect(screen.getByText('$49')).toBeInTheDocument();
    expect(screen.getByText('Total paid')).toBeInTheDocument();
    expect(screen.getByText('$147')).toBeInTheDocument();
    expect(
      screen.getByText('Paid in full by PayPal on 14 Aug 2026 · Test mode — no card is charged.'),
    ).toBeInTheDocument();
  });

  it('có hoàn: thêm dòng "Refunded −…" với số tiền đủ hai số lẻ', () => {
    renderPanel({ ...PAID, status: 'PARTIALLY_REFUNDED', refundedTotal: '73.50' });
    expect(screen.getByText('Refunded')).toBeInTheDocument();
    expect(screen.getByText('−$73.50')).toBeInTheDocument();
  });

  it('chưa trả: nhãn "Total", không có dòng "Paid in full"', () => {
    renderPanel(
      { ...PAID, status: 'PENDING', paidAt: null, cancellation: null },
      'awaiting_payment',
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText('Total paid')).toBeNull();
    expect(screen.queryByText(/^Paid in full/)).toBeNull();
  });

  it('Cancellation: câu hạn huỷ của server', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Cancellation' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Free cancellation until 2 Nov, 11:59 pm Vietnam time. No refund after that.',
      ),
    ).toBeInTheDocument();
  });

  it('đơn đã huỷ: bỏ khối Cancellation (cột phải đã nói)', () => {
    // Yêu cầu huỷ của luồng cũ còn trên dữ liệu: không có cổng giai đoạn thì ghi chú ấy kéo
    // khối Cancellation trở lại, lặp đúng câu `TripClosedPanel` đã in ở cột phải.
    renderPanel(
      {
        ...PAID,
        status: 'CANCELLED',
        cancellation: null,
        refundedTotal: '147.00',
        cancellationStatus: 'DENIED',
        cancellationRequestedAt: '2026-09-19T08:00:00.000Z',
      },
      'cancelled',
    );
    expect(screen.queryByRole('heading', { name: 'Cancellation' })).toBeNull();
  });

  it('Details: điểm hẹn, "None" khi không có yêu cầu, ngày ĐẶT', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Details' })).toBeInTheDocument();
    expect(screen.getByText('Meeting point')).toBeInTheDocument();
    expect(screen.getByText('Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ')).toBeInTheDocument();
    expect(screen.getByText('Special requests')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
    expect(screen.getByText('13 Aug 2026')).toBeInTheDocument();
  });

  it('Details: có yêu cầu thì in nguyên văn; không có dữ liệu tour thì bỏ dòng điểm hẹn', () => {
    renderPanel({ ...PAID, specialRequests: 'Vegetarian meals' }, 'upcoming', null);
    expect(screen.getByText('Vegetarian meals')).toBeInTheDocument();
    expect(screen.queryByText('None')).toBeNull();
    expect(screen.queryByText('Meeting point')).toBeNull();
  });
});

describe('BookingDetailsPanel — hàng nút đáy', () => {
  it('sắp đi, còn huỷ được: Cancel booking bên trái; Contact us và View voucher bên phải', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'View voucher' })).toHaveAttribute(
      'href',
      '/checkout/success?code=BK-B6VCOQNW',
    );
    expect(screen.queryByText('Questions about this trip?')).toBeNull();
  });

  it('đã đi: câu hỏi thay chỗ nút huỷ, vẫn có View voucher', () => {
    renderPanel({ ...PAID, cancellation: { ...CANCELLATION, canCancel: false } }, 'travelled');
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    expect(screen.getByText('Questions about this trip?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View voucher' })).toBeInTheDocument();
  });

  it('chờ trả: không nút huỷ, không View voucher — nút trả tiền ở cột phải', () => {
    renderPanel(
      { ...PAID, status: 'PENDING', paidAt: null, cancellation: null },
      'awaiting_payment',
    );
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay now' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'View voucher' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Contact us' })).toBeInTheDocument();
  });

  it('đã huỷ: không View voucher', () => {
    renderPanel(
      { ...PAID, status: 'CANCELLED', cancellation: null, refundedTotal: '147.00' },
      'cancelled',
    );
    expect(screen.queryByRole('link', { name: 'View voucher' })).toBeNull();
  });
});
