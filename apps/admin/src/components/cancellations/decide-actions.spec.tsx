import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DECIDE_CONTRACT_CODES } from '@/lib/cancellations-decide';
import { DecideActions, type DecideTarget } from './decide-actions';

const t = messages.admin.cancellations.decide;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

// Sau mọi kết cục đã-chạm-server, hàng đợi phải được kéo về tươi (nếp F2).
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

const REQUEST: DecideTarget = {
  id: '11111111-1111-4111-8111-111111111111',
  bookingCode: 'BK-ABCD1234',
  tourTitle: 'Ha Long Bay Cruise',
  customerName: 'Ada Lovelace',
  reason: 'Family emergency — cannot travel.',
  // Booking 120 đã hoàn 20 → phần còn lại 100 (dialog approve phải HIỆN số này).
  totalAmount: '120.00',
  refundedTotal: '20.00',
  currency: 'USD',
};

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

/** Mở dialog approve (hoặc deny) từ nút của hàng. */
async function open(user: ReturnType<typeof userEvent.setup>, which: 'approve' | 'deny') {
  await user.click(screen.getByRole('button', { name: which === 'approve' ? t.approve : t.deny }));
}

describe('DecideActions — confirm nêu rõ hệ quả (spec §3-F3)', () => {
  it('approve liệt kê ĐỦ ba hệ quả: refund phần còn lại · booking huỷ · nhả ghế', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');

    expect(await screen.findByText(t.approveDialog.consequences.refund)).toBeInTheDocument();
    expect(screen.getByText(t.approveDialog.consequences.cancelled)).toBeInTheDocument();
    expect(screen.getByText(t.approveDialog.consequences.seats)).toBeInTheDocument();
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();
  });

  it('approve hiện SỐ TIỀN sẽ hoàn — phần còn lại = total − đã hoàn (review F3)', async () => {
    // Khoá chống tái hiện: bản đầu bấm lệnh tiền mà không thấy con số nào.
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');

    expect(await screen.findByText(t.refundAmountValue('$100.00'))).toBeInTheDocument();
  });

  it('deny KHÔNG hiện dòng số tiền — không có gì được hoàn', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'deny');

    expect(await screen.findByText(t.denyDialog.body)).toBeInTheDocument();
    expect(screen.queryByText(t.refundAmount)).not.toBeInTheDocument();
  });

  it('deny nói rõ booking KHÔNG đổi — không có ba hệ quả tiền/ghế nào', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'deny');

    expect(await screen.findByText(t.denyDialog.body)).toBeInTheDocument();
    expect(screen.queryByText(t.approveDialog.consequences.refund)).not.toBeInTheDocument();
  });

  it('dialog mang đủ ngữ cảnh của hàng (booking, khách, lý do) để quyết mà không cần mở tab khác', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');

    expect(await screen.findByText('BK-ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Family emergency — cannot travel.')).toBeInTheDocument();
  });

  it('mở dialog KHÔNG bắn gì — phải bấm nút xác nhận trong dialog', async () => {
    const user = userEvent.setup();
    const decide = vi.fn();
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    expect(decide).not.toHaveBeenCalled();
  });
});

describe('DecideActions — input gửi đi', () => {
  it('approve gửi approve: true, không kèm note khi admin bỏ trống', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockResolvedValue({
      ok: true,
      approved: true,
      bookingCode: 'BK-ABCD1234',
      status: 'REFUNDED',
    });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(decide).toHaveBeenCalledWith({ id: REQUEST.id, approve: true });
  });

  it('deny gửi approve: false kèm note đã trim — note đi vào email cho khách', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockResolvedValue({
      ok: true,
      approved: false,
      bookingCode: 'BK-ABCD1234',
      status: 'DENIED',
    });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'deny');
    await user.type(await screen.findByLabelText(t.noteLabel), '  Departure is in 3 days.  ');
    await user.click(screen.getByRole('button', { name: t.denyDialog.submit }));

    expect(decide).toHaveBeenCalledWith({
      id: REQUEST.id,
      approve: false,
      decisionNote: 'Departure is in 3 days.',
    });
  });
});

describe('DecideActions — kết quả server', () => {
  it('thành công: toast + đóng dialog + router.refresh kéo hàng đợi tươi', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockResolvedValue({
      ok: true,
      approved: true,
      bookingCode: 'BK-ABCD1234',
      status: 'REFUNDED',
    });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(success).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.approveDialog.warning)).not.toBeInTheDocument();
  });

  it('REFUND_FAILED (retryable duy nhất) hiện đúng câu và dialog Ở LẠI (bất biến §2.4)', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockResolvedValue({ ok: false, code: 'REFUND_FAILED' });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.REFUND_FAILED);
    // Dialog còn mở: provider từ chối nhưng request còn nguyên — thử lại tại
    // chỗ là hợp lệ, ngữ cảnh + note giữ nguyên.
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lỗi TRẠNG-THÁI-CŨ (NOT_FOUND/ALREADY_DECIDED/NOT_REFUNDABLE): đóng + toast đúng câu + refresh', async () => {
    // Khoá chống tái hiện (review F3): copy hứa "the queue has been refreshed"
    // mà bản đầu không refresh — admin B bấm lặp vô hạn trên hàng đã quyết.
    for (const code of [...DECIDE_CONTRACT_CODES].filter((c) => c !== 'REFUND_FAILED')) {
      const user = userEvent.setup();
      const decide = vi.fn().mockResolvedValue({ ok: false, code });
      const view = render(<DecideActions request={REQUEST} decide={decide} />);
      await open(user, 'approve');
      await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

      expect(errorToast).toHaveBeenCalledWith(t.errors[code]);
      expect(refresh).toHaveBeenCalled();
      expect(screen.queryByText(t.approveDialog.warning)).not.toBeInTheDocument();
      expect(success).not.toHaveBeenCalled();
      view.unmount();
      errorToast.mockReset();
      refresh.mockReset();
    }
  });

  it('kết cục KHÔNG RÕ (GENERIC): đóng dialog + toast lỗi + refresh — không mời bấm lại mù', async () => {
    // Khoá chống refund đúp: approve gọi provider BÊN TRONG request, nên sau
    // một kết cục mập mờ admin phải nhìn dữ liệu tươi trước khi thử lại.
    const user = userEvent.setup();
    const decide = vi.fn().mockResolvedValue({ ok: false, code: 'GENERIC' });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(errorToast).toHaveBeenCalledWith(messages.admin.errors.write.GENERIC);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.approveDialog.warning)).not.toBeInTheDocument();
  });

  it('action NÉM (mạng đứt) đối xử như GENERIC: đóng + toast + refresh', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockRejectedValue(new Error('boom'));
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(errorToast).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('đang bắn thì Esc KHÔNG đóng được dialog — lỗi về sau không được phép tàng hình', async () => {
    const user = userEvent.setup();
    let settle: (value: { ok: false; code: 'REFUND_FAILED' }) => void = () => {};
    const decide = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve as typeof settle;
        }),
    );
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    await user.keyboard('{Escape}');
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();

    settle({ ok: false, code: 'REFUND_FAILED' });
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.REFUND_FAILED);
  });

  it('bấm hai lần liên tiếp chỉ bắn MỘT lệnh — approve là money-path', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    const submit = await screen.findByRole('button', { name: t.approveDialog.submit });
    await user.click(submit);
    await user.click(submit);

    expect(decide).toHaveBeenCalledTimes(1);
  });
});
