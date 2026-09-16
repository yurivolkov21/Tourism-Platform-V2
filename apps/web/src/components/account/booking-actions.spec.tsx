import { createORPCErrorFromJson, ORPCError } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookingCancellation } from '@tourism/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingView } from '@/lib/booking-vm';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingActions, type CancelDialogBooking } from './booking-actions';

/**
 * BookingActions CHỈ render theo `BookingView.actions` — spec phủ đủ ba
 * `BookingAction`, hai dạng hộp xác nhận huỷ (trong hạn / quá hạn, ADR-0041),
 * CỘNG hành động THẬT khi có `code` (describe cuối file).
 */

// Mock next/navigation — `router.refresh()` sau mutation thành công.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

// Mock client oRPC — spec chỉ kiểm gọi ĐÚNG procedure/payload, không gọi API thật.
const { checkout, cancelPending, cancel } = vi.hoisted(() => ({
  checkout: vi.fn(),
  cancelPending: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { checkout, cancelPending, cancel } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

// Mock sonner — toast CHỈ cho kết quả thành công.
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

const CODE = 'BK-20260904-WXYZ';

const PAID_VIEW: BookingView = {
  tone: 'success',
  statusKey: 'PAID',
  actions: ['cancelBooking'],
};

/** Cờ huỷ SERVER trả — mặc định còn hạn, hoàn 1200. */
function cancellationOf(overrides: Partial<BookingCancellation> = {}): BookingCancellation {
  return {
    deadline: '2026-10-13',
    withinDeadline: true,
    refundAmount: '1200.00',
    canCancel: true,
    ...overrides,
  };
}

/** Quá hạn chót nhưng chưa khởi hành — huỷ được, hoàn 0. */
const AFTER_DEADLINE = cancellationOf({ withinDeadline: false, refundAmount: '0.00' });

function dialogBooking(
  cancellation: BookingCancellation | null = cancellationOf(),
): CancelDialogBooking {
  return {
    code: CODE,
    tourTitle: 'Ha Long Bay Overnight Cruise',
    tourSlug: 'ha-long-bay-cruise',
    departureStartDate: '2026-10-20',
    departureEndDate: '2026-10-23',
    numAdults: 2,
    numChildren: 1,
    currency: 'USD',
    cancellation,
  };
}

const POLICY_LINK = 'Read our cancellation & refund policy';

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it('payNow-only (KHÔNG có action huỷ) → KHÔNG render policy link', () => {
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['payNow'] };
    render(<BookingActions view={view} />);

    expect(screen.getByRole('button', { name: 'Pay now' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: POLICY_LINK })).not.toBeInTheDocument();
  });

  it('cancelPending → mở dialog confirm, bấm "Yes, cancel it" gọi onAction("cancelPending")', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} onAction={onAction} />);

    expect(screen.getByRole('link', { name: POLICY_LINK })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    expect(onAction).toHaveBeenCalledWith('cancelPending');
  });

  it('cancelBooking → nút "Cancel booking" cùng policy link ngay cạnh', () => {
    render(<BookingActions view={PAID_VIEW} booking={dialogBooking()} />);

    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: POLICY_LINK })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('cancelBooking mà trang không truyền dữ liệu hộp xác nhận → không bày nút huỷ', () => {
    render(<BookingActions view={PAID_VIEW} />);
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
  });

  it('cancelBooking mà cờ huỷ null → không bày nút huỷ', () => {
    render(<BookingActions view={PAID_VIEW} booking={dialogBooking(null)} />);
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
  });

  it('không còn trạng thái "requested / pending / resubmit" nào', () => {
    render(<BookingActions view={PAID_VIEW} booking={dialogBooking()} />);
    expect(screen.queryByText(/pending review/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /request cancellation/i })).toBeNull();
  });

  it('actions rỗng (terminal) → không render gì', () => {
    const view: BookingView = { tone: 'muted', statusKey: 'CANCELLED', actions: [] };
    const { container } = render(<BookingActions view={view} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('KHÔNG truyền onAction lẫn code → bấm xác nhận không throw, không gọi API', async () => {
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));
    expect(cancel).not.toHaveBeenCalled();
  });
});

/**
 * Hộp xác nhận hai dạng (spec §5.3). Câu, số tiền và ngày đều IN từ cờ server
 * (`cancellation`) — component không tự so ngày chót với giờ trình duyệt.
 */
describe('BookingActions — hộp xác nhận huỷ', () => {
  async function openDialog(booking: CancelDialogBooking, onAction = vi.fn()) {
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} booking={booking} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    return { user, onAction };
  }

  it('trong hạn → hỏi kèm số tiền hoàn đủ và thời gian tiền về; nút nói số tiền', async () => {
    await openDialog(dialogBooking());

    expect(
      screen.getByText(
        'Cancel and get a full refund of $1,200.00? It usually reaches your original payment method in 5–10 business days.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Something serious happened? Contact us' }),
    ).toBeNull();
  });

  it('quá hạn → nói ngày chót đã qua, không hoàn, kèm link hỏi đáp của tour', async () => {
    await openDialog(dialogBooking(AFTER_DEADLINE));

    expect(
      screen.getByText(
        'The free-cancellation deadline (13 Oct) has passed. If you cancel now, you won’t be refunded.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel without refund' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Something serious happened? Contact us' }),
    ).toHaveAttribute('href', '/tours/ha-long-bay-cruise/enquire');
  });

  it('nói RÕ đang huỷ booking nào — tên tour, số khách, mã', async () => {
    await openDialog(dialogBooking());

    expect(screen.getByText('Ha Long Bay Overnight Cruise')).toBeInTheDocument();
    expect(screen.getByText('2 adults, 1 child')).toBeInTheDocument();
    expect(screen.getByText(CODE)).toBeInTheDocument();
  });

  it('bỏ hẳn ước tính theo phần trăm, số ngày, ân hạn và mục "What happens next"', async () => {
    await openDialog(dialogBooking());

    expect(screen.queryByText(/% of/)).toBeNull();
    expect(screen.queryByText(/departs in/i)).toBeNull();
    expect(screen.queryByText(/24 hours/)).toBeNull();
    expect(screen.queryByText('What happens next')).toBeNull();
  });

  it('lý do không bắt buộc: bấm xác nhận khi ô trống → onAction nhận reason undefined', async () => {
    const { user, onAction } = await openDialog(dialogBooking());

    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));
    expect(onAction).toHaveBeenCalledWith('cancelBooking', undefined);
  });

  it('có gõ lý do → onAction nhận lý do đã trim', async () => {
    const { user, onAction } = await openDialog(dialogBooking(AFTER_DEADLINE));

    await user.type(screen.getByRole('textbox'), '  Plans changed  ');
    await user.click(screen.getByRole('button', { name: 'Cancel without refund' }));
    expect(onAction).toHaveBeenCalledWith('cancelBooking', 'Plans changed');
  });
});

/**
 * Hành động THẬT — page truyền `code`, KHÔNG truyền `onAction` → component tự
 * gọi oRPC (try/catch/finally; 401 giữa chừng → message + link đăng nhập; lỗi
 * khác → copy theo mã lỗi; KHÔNG mất state).
 */
describe('BookingActions — hành động thật (code, không có onAction)', () => {
  it('payNow → gọi bookings.checkout({code}), thành công → redirect tới checkoutUrl', async () => {
    // jsdom `window.location.assign` không implement và không configurable —
    // thay cả object `location` qua `vi.stubGlobal`, phục hồi ở cuối test.
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    checkout.mockResolvedValueOnce({ checkoutUrl: 'https://checkout.example/session/abc' });
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['payNow'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Pay now' }));

    await waitFor(() => expect(checkout).toHaveBeenCalledWith({ code: CODE }, expect.anything()));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://checkout.example/session/abc'),
    );
    vi.unstubAllGlobals();
  });

  it('payNow gặp DEPARTURE_NOT_AVAILABLE (chuyến đã qua hạn đặt) → câu "đã ngừng nhận đặt"', async () => {
    checkout.mockRejectedValueOnce(new ORPCError('DEPARTURE_NOT_AVAILABLE', { status: 400 }));
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['payNow'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Pay now' }));

    expect(await screen.findByText('Booking for this departure has closed.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('cancelPending → confirm → gọi bookings.cancelPending({code}), thành công → toast + refresh', async () => {
    cancelPending.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    await waitFor(() =>
      expect(cancelPending).toHaveBeenCalledWith({ code: CODE }, expect.anything()),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Booking cancelled', {
      description: 'Your pending reservation has been released.',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('cancelBooking có lý do → gọi bookings.cancel({code, reason}); toast nói số tiền ĐÃ hoàn + refresh', async () => {
    cancel.mockResolvedValueOnce({
      booking: makeBooking({ code: CODE, status: 'CANCELLED', currency: 'USD' }),
      refundedAmount: '1200.00',
    });
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.type(screen.getByRole('textbox'), 'Family emergency');
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));

    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith(
        { code: CODE, reason: 'Family emergency' },
        expect.anything(),
      ),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Booking cancelled', {
      description: '$1,200.00 has been refunded to your original payment method.',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('cancelBooking ô lý do chỉ có khoảng trắng → input KHÔNG mang reason; hoàn 0 → toast "không hoàn"', async () => {
    cancel.mockResolvedValueOnce({
      booking: makeBooking({ code: CODE, status: 'CANCELLED', currency: 'USD' }),
      refundedAmount: '0.00',
    });
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking(AFTER_DEADLINE)} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: 'Cancel without refund' }));

    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    // `toHaveBeenCalledWith` coi `reason: undefined` bằng với vắng khoá — soi thẳng payload.
    const input = cancel.mock.calls[0]?.[0];
    expect(input).toEqual({ code: CODE });
    expect(input).not.toHaveProperty('reason');
    expect(toastSuccess).toHaveBeenCalledWith('Booking cancelled', {
      description: 'No refund was due on this booking.',
    });
  });

  it('REFUND_FAILED → câu "booking chưa đổi, thử lại" trong hộp; không refresh; nút bấm lại được', async () => {
    cancel.mockRejectedValueOnce(new ORPCError('REFUND_FAILED', { status: 502 }));
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));

    expect(
      await screen.findByText(
        'We couldn’t process your refund, so your booking hasn’t changed. Please try again.',
      ),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' })).toBeEnabled();
  });

  it('NOT_CANCELLABLE → câu "không huỷ online được" và làm mới trang', async () => {
    cancel.mockRejectedValueOnce(new ORPCError('NOT_CANCELLABLE', { status: 422 }));
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));

    expect(
      await screen.findByText('This booking can’t be cancelled online. Contact us for help.'),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('lỗi chung (network/5xx) → message lỗi inline, KHÔNG mất state', async () => {
    cancelPending.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Yes, cancel it' })).toBeEnabled();
  });

  it('401 giữa chừng → message riêng + link /login?redirect=, KHÔNG auto-signout', async () => {
    cancel.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Unauthorized',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute(
      'href',
      `/login?redirect=/account/bookings/${CODE}`,
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
