import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { bookingView } from '@/lib/booking-vm';
import { makeBooking } from '@/test/fixtures/booking';
import { AwaitingPaymentPanel } from './awaiting-payment-panel';

// `BookingActions` dùng router và client oRPC — khoá cả hai, spec chỉ soi phần vẽ.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { checkout: vi.fn(), cancelPending: vi.fn(), cancel: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

describe('AwaitingPaymentPanel', () => {
  it('số tiền phải trả và hai nút sẵn có của BookingActions', () => {
    const booking = makeBooking({
      code: 'BK-PENDING1',
      status: 'PENDING',
      paidAt: null,
      totalAmount: '147.00',
      cancellation: null,
    });
    render(<AwaitingPaymentPanel booking={booking} view={bookingView(booking, null)} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Awaiting payment' })).toBeInTheDocument();
    expect(screen.getByText('$147')).toBeInTheDocument();
    expect(screen.getByText('Total · Taxes and fees included')).toBeInTheDocument();
    expect(
      screen.getByText('This code becomes your voucher once payment is complete.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
  });
});
