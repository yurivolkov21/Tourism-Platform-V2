import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingView } from '@/lib/booking-vm';
import { BookingActions } from './booking-actions';

/**
 * BookingActions CHỈ render theo `BookingView.actions` (bảng quyết định
 * `bookingView`, Task 2) — spec này phủ đủ 5 `BookingAction` + hai nhánh
 * rỗng (terminal, không action nào), CỘNG hành động THẬT khi có `code`
 * (Task 7/A2 — không truyền `onAction`, xem describe cuối file).
 */

// Mock next/navigation — `router.refresh()` sau mutation thành công (spec
// §5), cùng khuôn `user-menu.spec.tsx`.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

// Mock client oRPC — spec chỉ kiểm gọi ĐÚNG procedure/payload, không gọi API
// thật (cùng khuôn `newsletter-form.spec.tsx`).
const { checkout, cancelPending, cancel } = vi.hoisted(() => ({
  checkout: vi.fn(),
  cancelPending: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { checkout, cancelPending, cancel } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

// Mock sonner — toast CHỈ cho kết quả thành công (spec §5).
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

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

  it('resubmitCancellation → mở dialog, gõ lý do rồi gửi mới gọi onAction KÈM lý do', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['resubmitCancellation'],
    };
    render(<BookingActions view={view} onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: 'Request cancellation again' }));
    await user.type(screen.getByRole('textbox'), 'Plans changed');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(onAction).toHaveBeenCalledWith('resubmitCancellation', 'Plans changed');
  });

  it('KHÔNG còn hiện lý do admin từ chối — prop đó LUÔN null, là code chết', () => {
    // Contract khách cố ý không mang `decisionNote` (ghi chú nội bộ của admin).
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['resubmitCancellation'],
    };
    render(<BookingActions view={view} onAction={vi.fn()} />);
    expect(screen.queryByText(/previous request was declined/i)).not.toBeInTheDocument();
  });

  it('actions rỗng (terminal: CANCELLED/REFUNDED/PARTIALLY_REFUNDED) → không render gì', () => {
    const view: BookingView = { tone: 'muted', statusKey: 'CANCELLED', actions: [] };
    const { container } = render(<BookingActions view={view} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('KHÔNG truyền onAction lẫn code (page A1) → bấm nút không throw, không gọi API', async () => {
    const user = userEvent.setup();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} />);
    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    expect(cancel).not.toHaveBeenCalled();
  });
});

/**
 * Hành động THẬT (Task 7/A2) — page truyền `code`, KHÔNG truyền `onAction`
 * → component tự gọi oRPC (khuôn xử lý lỗi: try/catch/finally, 401 giữa
 * chừng → message + link đăng nhập, lỗi khác → generic, KHÔNG mất state).
 */
describe('BookingActions — hành động thật (code, không có onAction)', () => {
  const CODE = 'BK-20260805-ABCD';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('payNow → gọi bookings.checkout({code}), thành công → redirect tới checkoutUrl', async () => {
    // jsdom `window.location.assign` throw "Not implemented" khi gọi thật
    // (giới hạn jsdom, không phải bug) và property `assign` không
    // configurable nên `vi.spyOn` không redefine được — thay hẳn object
    // `location` bằng bản giả qua `vi.stubGlobal` (tự phục hồi bằng
    // `vi.unstubAllGlobals()` ở cuối test, KHÔNG rò sang test khác).
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

  it('cancelPending → confirm → gọi bookings.cancelPending({code}), thành công → toast + router.refresh()', async () => {
    cancelPending.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    await waitFor(() =>
      expect(cancelPending).toHaveBeenCalledWith({ code: CODE }, expect.anything()),
    );
    expect(toastSuccess).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('requestCancellation → gọi bookings.cancel({code, reason}), thành công → toast + router.refresh()', async () => {
    cancel.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    await user.type(screen.getByRole('textbox'), 'Family emergency');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() =>
      // Lý do KHÁCH GÕ, không phải hằng số cứng — chuỗi cũ còn được email
      // ngược lại cho chính họ.
      expect(cancel).toHaveBeenCalledWith(
        { code: CODE, reason: 'Family emergency' },
        expect.anything(),
      ),
    );
    expect(toastSuccess).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('lý do RỖNG → chặn ngay ở client, KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(cancel).not.toHaveBeenCalled();
    expect(
      screen.getByText('Please tell us why — our team needs it to process a refund.'),
    ).toBeInTheDocument();
  });

  it('lý do chỉ có khoảng trắng cũng bị chặn', async () => {
    const user = userEvent.setup();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(cancel).not.toHaveBeenCalled();
  });

  it('resubmitCancellation → gọi bookings.cancel({code, reason}) (cùng route với requestCancellation)', async () => {
    cancel.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['resubmitCancellation'],
    };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Request cancellation again' }));
    await user.type(screen.getByRole('textbox'), 'Still need to cancel');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith(
        { code: CODE, reason: 'Still need to cancel' },
        expect.anything(),
      ),
    );
  });

  it('lỗi chung (network/5xx) → message lỗi inline, KHÔNG mất state (nút vẫn còn, hết pending)', async () => {
    cancelPending.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    // Nút hết pending — `AlertDialogAction` không tự đóng dialog (khác
    // `AlertDialogCancel`, xem `alert-dialog.tsx`) nên dialog vẫn mở, nút xác
    // nhận vẫn còn NGUYÊN trên trang và bấm lại được (không kẹt disabled).
    expect(screen.getByRole('button', { name: 'Yes, cancel it' })).toBeEnabled();
  });

  it('401 giữa chừng (session hết hạn) → message riêng + link /login?redirect=, KHÔNG auto-signout', async () => {
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
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    await user.type(screen.getByRole('textbox'), 'Session will die');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: 'Log in again' });
    expect(loginLink).toHaveAttribute('href', `/login?redirect=/account/bookings/${CODE}`);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('409 → copy RIÊNG "đã gửi rồi", không phải câu lỗi chung', async () => {
    // Trước cụm này, 409 và 422 đều rơi vào 'generic' dù i18n đã có copy riêng
    // cho đúng hai tình huống đó — khách bị báo "có gì đó sai" trong khi hệ
    // thống biết chính xác chuyện gì.
    cancel.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'CONFLICT',
        status: 409,
        message: 'Already requested',
        data: null,
      }),
    );
    const user = userEvent.setup();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    await user.type(screen.getByRole('textbox'), 'Duplicate');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(
      await screen.findByText('You’ve already sent a cancellation request for this booking.'),
    ).toBeInTheDocument();
  });

  it('422 → copy RIÊNG "không huỷ online được"', async () => {
    cancel.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'UNPROCESSABLE_CONTENT',
        status: 422,
        message: 'Not cancellable',
        data: null,
      }),
    );
    const user = userEvent.setup();
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    await user.type(screen.getByRole('textbox'), 'Too late');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(
      await screen.findByText('This booking can’t be cancelled online. Contact us for help.'),
    ).toBeInTheDocument();
  });
});
