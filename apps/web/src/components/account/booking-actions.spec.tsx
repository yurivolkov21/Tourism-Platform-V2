import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BookingView } from '@/lib/booking-vm';
import { BookingActions } from './booking-actions';

/**
 * BookingActions CHỈ render theo `BookingView.actions` (bảng quyết định
 * `bookingView`, Task 2) — spec này phủ đủ 5 `BookingAction` + hai nhánh
 * rỗng (terminal, không action nào).
 */
describe('BookingActions', () => {
  it('PENDING (payNow + cancelPending) → hai nút, bấm Pay now gọi onAction đúng tham số', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const view: BookingView = {
      tone: 'warning',
      statusKey: 'PENDING',
      actions: ['payNow', 'cancelPending'],
    };
    render(<BookingActions view={view} onAction={onAction} />);

    expect(screen.getByRole('button', { name: 'Pay now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pay now' }));
    expect(onAction).toHaveBeenCalledWith('payNow');
  });

  it('cancelPending → mở dialog confirm, bấm "Yes, cancel it" gọi onAction("cancelPending")', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    expect(onAction).toHaveBeenCalledWith('cancelPending');
  });

  it('requestCancellation (PAID, chưa từng yêu cầu hủy) → nút "Request cancellation"', () => {
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} />);
    expect(screen.getByRole('button', { name: 'Request cancellation' })).toBeInTheDocument();
  });

  it('viewCancellationPending → text trạng thái, KHÔNG có nút', () => {
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['viewCancellationPending'],
    };
    render(<BookingActions view={view} />);
    expect(screen.getByText('Cancellation requested — pending review.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('resubmitCancellation → hiện lý do bị từ chối + nút gửi lại, bấm gọi onAction đúng tham số', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['resubmitCancellation'],
    };
    render(
      <BookingActions
        view={view}
        deniedNote="Departure is less than 14 days away."
        onAction={onAction}
      />,
    );

    expect(
      screen.getByText('Your previous request was declined: Departure is less than 14 days away.'),
    ).toBeInTheDocument();
    const resubmitBtn = screen.getByRole('button', { name: 'Request cancellation again' });
    await user.click(resubmitBtn);
    expect(onAction).toHaveBeenCalledWith('resubmitCancellation');
  });

  it('actions rỗng (terminal: CANCELLED/REFUNDED/PARTIALLY_REFUNDED) → không render gì', () => {
    const view: BookingView = { tone: 'muted', statusKey: 'CANCELLED', actions: [] };
    const { container } = render(<BookingActions view={view} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('KHÔNG truyền onAction (page A1) → bấm nút không throw, không làm gì', async () => {
    const user = userEvent.setup();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} />);
    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    // Không throw là đủ — không có assertion phụ, chỉ cần render sống sót.
  });
});
