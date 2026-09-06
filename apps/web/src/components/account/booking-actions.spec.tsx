import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingView } from '@/lib/booking-vm';
import { BookingActions, type RefundEstimateInput } from './booking-actions';

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

  it('payNow-only (KHÔNG có action hủy) → KHÔNG render policy link', () => {
    const view: BookingView = {
      tone: 'warning',
      statusKey: 'PENDING',
      actions: ['payNow'],
    };
    render(<BookingActions view={view} />);

    expect(screen.getByRole('button', { name: 'Pay now' })).toBeInTheDocument();
    // Policy link KHÔNG render ở nhánh này (chỉ render ở 3 nhánh có hành động hủy)
    expect(
      screen.queryByRole('link', { name: 'Read our cancellation & refund policy' }),
    ).not.toBeInTheDocument();
  });

  it('cancelPending → mở dialog confirm, bấm "Yes, cancel it" gọi onAction("cancelPending")', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} onAction={onAction} />);

    // Policy link phải hiện cạnh nút hủy (Task 7) — kiểm TRƯỚC mở dialog
    expect(
      screen.getByRole('link', { name: 'Read our cancellation & refund policy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Read our cancellation & refund policy' }),
    ).toHaveAttribute('href', '/cancellation-policy');

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

    // Policy link phải hiện cạnh nút hủy (Task 7)
    expect(
      screen.getByRole('link', { name: 'Read our cancellation & refund policy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Read our cancellation & refund policy' }),
    ).toHaveAttribute('href', '/cancellation-policy');
  });

  it('viewCancellationPending → text trạng thái, KHÔNG có nút, KHÔNG có policy link', () => {
    const view: BookingView = {
      tone: 'success',
      statusKey: 'PAID',
      actions: ['viewCancellationPending'],
    };
    render(<BookingActions view={view} />);
    expect(screen.getByText('Cancellation requested — pending review.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    // Policy link KHÔNG render ở nhánh này (chỉ render ở 3 nhánh có hành động hủy)
    expect(
      screen.queryByRole('link', { name: 'Read our cancellation & refund policy' }),
    ).not.toBeInTheDocument();
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

    // Policy link phải hiện cạnh nút hủy (Task 7) — kiểm TRƯỚC mở dialog
    expect(
      screen.getByRole('link', { name: 'Read our cancellation & refund policy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Read our cancellation & refund policy' }),
    ).toHaveAttribute('href', '/cancellation-policy');

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

/**
 * Khối tóm tắt trong dialog xin huỷ (ADR-0030 §3b; thiết kế lại 04/09 — rộng
 * ra, chia hai nửa, thêm "what happens next").
 *
 * Từ W1 (audit 05/09 cụm 3) con số đến từ SERVER (`bookings.byCode` trả
 * `refundEstimate`) và component chỉ IN — luật tiền (bậc/ân hạn/làm tròn cent)
 * được canh ở `refund-policy.spec.ts` của contract và int test API; ở đây canh
 * phần trình bày: in đúng số server gửi, không tự tính, không tự bịa khi vắng.
 */
describe('CancelRequestDialog — khối tóm tắt', () => {
  const PAID_VIEW: BookingView = {
    tone: 'success',
    statusKey: 'PAID',
    actions: ['requestCancellation'],
  };

  /** Ngày lịch UTC cách hôm nay đúng `days` ngày — chỉ để hiển thị đợt. */
  function departureIn(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function refundFor(overrides: Partial<RefundEstimateInput> = {}): RefundEstimateInput {
    return {
      code: 'BK-20260904-WXYZ',
      tourTitle: 'Ha Long Bay Overnight Cruise',
      departureStartDate: departureIn(40),
      departureEndDate: departureIn(42),
      numAdults: 2,
      numChildren: 1,
      totalAmount: '1000.00',
      refundedTotal: '0',
      currency: 'USD',
      // Ước tính SERVER gửi — bậc 100% của ca mặc định.
      estimate: { percent: 100, amount: '1000.00', daysBeforeDeparture: 40, inGrace: false },
      ...overrides,
    };
  }

  async function openDialog(overrides: Partial<RefundEstimateInput> = {}) {
    const user = userEvent.setup();
    render(
      <BookingActions view={PAID_VIEW} code="BK-20260904-WXYZ" refund={refundFor(overrides)} />,
    );
    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
  }

  it('nói RÕ đang huỷ booking nào — tên tour, đợt, số khách, mã', async () => {
    // Bản đầu chỉ có con số hoàn mà không hề nói nó thuộc booking nào; khách
    // có nhiều booking thì đó là một dialog không xác nhận được điều gì.
    await openDialog();

    expect(screen.getByText('Ha Long Bay Overnight Cruise')).toBeInTheDocument();
    expect(screen.getByText('BK-20260904-WXYZ')).toBeInTheDocument();
    expect(screen.getByText('2 adults, 1 child')).toBeInTheDocument();
  });

  it('in ĐÚNG con số server gửi — amount, percent, số ngày; giữ nguyên cent', async () => {
    // 599.51 (không phải .50) canh luôn formatMoneyExact: con số khách chụp
    // màn hình là con số admin duyệt, server đã làm tròn — client không đụng.
    await openDialog({
      totalAmount: '1199.01',
      estimate: { percent: 50, amount: '599.51', daysBeforeDeparture: 20, inGrace: false },
    });

    expect(screen.getByText('$599.51')).toBeInTheDocument();
    expect(screen.getByText('50% of $1,199.01')).toBeInTheDocument();
    expect(screen.queryByText('$600')).toBeNull();
  });

  it('bậc 0%: in $0.00 — không nói dối con số dễ chịu hơn', async () => {
    await openDialog({
      departureStartDate: departureIn(3),
      departureEndDate: departureIn(3),
      estimate: { percent: 0, amount: '0.00', daysBeforeDeparture: 3, inGrace: false },
    });

    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('0% of $1,000.00')).toBeInTheDocument();
  });

  it('server báo trong ân hạn → hiện câu 24 giờ; ngoài ân hạn thì không', async () => {
    await openDialog({
      estimate: { percent: 100, amount: '1000.00', daysBeforeDeparture: 3, inGrace: true },
    });

    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You are still within 24 hours of paying, so this cancellation is refunded in full.',
      ),
    ).toBeInTheDocument();
  });

  it('đã hoàn một phần → con số lớn là phần CÒN LẠI (server đã trừ), và nói ra phần đã hoàn', async () => {
    await openDialog({
      refundedTotal: '150.00',
      estimate: { percent: 100, amount: '850.00', daysBeforeDeparture: 40, inGrace: false },
    });

    expect(screen.getByText('$850.00')).toBeInTheDocument();
    expect(screen.getByText('$150.00 already refunded')).toBeInTheDocument();
  });

  it('server không gửi ước tính → KHÔNG tự tính, không bịa số — vẫn còn link chính sách', async () => {
    await openDialog({ estimate: null });

    expect(screen.queryByText(/of \$1,000\.00/)).toBeNull();
    expect(screen.getByRole('link', { name: 'See the full refund schedule' })).toBeInTheDocument();
  });

  it('"what happens next" hiện cả khi trang chưa truyền ước tính', async () => {
    // Ba câu ấy đúng với MỌI yêu cầu huỷ đã trả tiền — chúng không phụ thuộc
    // vào con số, nên không được biến mất cùng con số.
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code="BK-20260904-WXYZ" />);
    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));

    expect(screen.getByText('What happens next')).toBeInTheDocument();
    expect(
      screen.getByText('Any refund goes back to the card or PayPal account you paid with.'),
    ).toBeInTheDocument();
  });
});
