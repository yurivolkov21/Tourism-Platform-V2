import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DECIDE_CONTRACT_CODES, isStaleStateCode } from '@/lib/cancellations-decide';
import { DecideActions, type DecideTarget } from './decide-actions';

const t = messages.admin.cancellations.decide;
const w = t.approveWizard;

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

/**
 * Mọi mốc thời gian GHIM CỨNG và tương đối với nhau, không với hôm nay: bậc
 * hoàn tiền đo khoảng cách từ lúc GỬI yêu cầu tới ngày khởi hành, nên fixture
 * này cho cùng kết quả ở mọi ngày chạy test.
 *
 * Gửi trước 20 ngày → bậc 50%. Booking 120, đã hoàn 20:
 * - mức chính sách = 50% của 120, trừ 20 đã hoàn = **40.00**
 * - phần còn hoàn được = 120 − 20 = **100.00**
 *
 * Hai con số CỐ Ý khác nhau — trước ADR-0029 approve luôn hoàn trọn phần dư,
 * nên chỉ khi chúng lệch nhau thì test mới phân biệt được hai hành vi.
 */
const REQUEST: DecideTarget = {
  id: '11111111-1111-4111-8111-111111111111',
  bookingCode: 'BK-ABCD1234',
  tourTitle: 'Ha Long Bay Cruise',
  customerName: 'Ada Lovelace',
  reason: 'Family emergency — cannot travel.',
  totalAmount: '120.00',
  refundedTotal: '20.00',
  currency: 'USD',
  requestedAt: '2026-09-01T00:00:00.000Z',
  // Ngoài ân hạn 24h, để bậc theo ngày là thứ duy nhất quyết con số.
  paidAt: '2026-08-01T00:00:00.000Z',
  departureStartDate: '2026-09-21',
  freeCancellationDays: null,
};

const POLICY_AMOUNT = '40.00';

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

/** Mở dialog từ nút của hàng. */
async function open(user: ReturnType<typeof userEvent.setup>, which: 'approve' | 'deny') {
  await user.click(screen.getByRole('button', { name: which === 'approve' ? t.approve : t.deny }));
}

/** Mở approve rồi đi hết stepper tới bước Confirm — ba lần Continue. */
async function openApproveToConfirm(user: ReturnType<typeof userEvent.setup>) {
  await open(user, 'approve');
  for (let step = 0; step < 3; step += 1) {
    await user.click(await screen.findByRole('button', { name: w.next }));
  }
}

describe('DecideActions — stepper approve (ADR-0029 §5)', () => {
  it('mở ra ở bước ĐẦU, không phải ở nút xác nhận', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');

    expect(await screen.findByText(w.request.heading)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.approveDialog.submit })).toBeNull();
  });

  it('KHÔNG nhảy cóc: bước chưa tới thì tab bị khoá', async () => {
    // Bấm thẳng sang Confirm là đúng cái "bấm bậy" mà stepper sinh ra để chặn.
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');

    expect(await screen.findByRole('tab', { name: w.steps.confirm })).toBeDisabled();
    expect(screen.getByRole('tab', { name: w.steps.request })).toBeEnabled();
  });

  it('bước Policy kể CĂN CỨ ra con số, không chỉ con số', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: w.next }));

    expect(await screen.findByText(w.policy.daysLine(20))).toBeInTheDocument();
    expect(screen.getByText(w.policy.band(50))).toBeInTheDocument();
    expect(screen.getByText(w.policy.countedFrom)).toBeInTheDocument();
    // 20 đã hoàn từ trước phải được nói ra — nó là lý do con số không tròn.
    expect(screen.getByText(w.policy.alreadyRefunded('$20.00'))).toBeInTheDocument();
  });

  it('bước Amount cảnh báo approve chỉ chạy MỘT lần', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: w.next }));
    await user.click(await screen.findByRole('button', { name: w.next }));

    expect(await screen.findByText(w.amount.onceWarning)).toBeInTheDocument();
  });

  it('bước Confirm liệt kê ĐỦ ba hệ quả, và câu refund mang SỐ TIỀN thật', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await openApproveToConfirm(user);

    expect(
      await screen.findByText(t.approveDialog.consequences.refund(`$${POLICY_AMOUNT}`)),
    ).toBeInTheDocument();
    expect(screen.getByText(t.approveDialog.consequences.cancelled)).toBeInTheDocument();
    expect(screen.getByText(t.approveDialog.consequences.seats)).toBeInTheDocument();
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();
  });

  it('mang đủ ngữ cảnh của hàng ngay từ bước đầu — khỏi mở tab khác', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');

    expect(await screen.findByText('BK-ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Family emergency — cannot travel.')).toBeInTheDocument();
  });

  it('mở dialog KHÔNG bắn gì — phải đi hết bốn bước rồi mới bấm xác nhận', async () => {
    const user = userEvent.setup();
    const decide = vi.fn();
    render(<DecideActions request={REQUEST} decide={decide} />);
    await openApproveToConfirm(user);
    expect(decide).not.toHaveBeenCalled();
  });
});

describe('DecideActions — số tiền gửi đi', () => {
  it('mặc định gửi mức CHÍNH SÁCH, không phải trọn phần dư', async () => {
    // Khoá chống tái hiện: trước ADR-0029 approve luôn hoàn 100.00 (phần dư).
    // Chính sách ở fixture này cho 40.00, nên một hồi quy là thấy ngay.
    const user = userEvent.setup();
    const decide = vi
      .fn()
      .mockResolvedValue({ ok: true, approved: true, bookingCode: 'BK-ABCD1234' });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await openApproveToConfirm(user);
    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

    expect(decide).toHaveBeenCalledWith({
      id: REQUEST.id,
      approve: true,
      refundAmount: POLICY_AMOUNT,
    });
  });

  it('vượt bậc: gửi số admin gõ, và BẮT ghi lý do trước khi bắn', async () => {
    const user = userEvent.setup();
    const decide = vi
      .fn()
      .mockResolvedValue({ ok: true, approved: true, bookingCode: 'BK-ABCD1234' });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: w.next }));
    await user.click(await screen.findByRole('button', { name: w.next }));
    await user.click(await screen.findByRole('radio', { name: w.amount.overrideOption }));
    await user.type(await screen.findByLabelText(w.amount.overrideLabel), '75');
    await user.click(screen.getByRole('button', { name: w.next }));

    // Bấm xác nhận khi chưa ghi lý do: KHÔNG bắn, và nói rõ vì sao.
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));
    expect(decide).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(w.confirm.noteRequired);

    await user.type(
      screen.getByLabelText(w.confirm.noteLabelRequired),
      '  Supplier refunded us.  ',
    );
    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

    expect(decide).toHaveBeenCalledWith({
      id: REQUEST.id,
      approve: true,
      refundAmount: '75',
      decisionNote: 'Supplier refunded us.',
    });
  });

  it('vượt bậc quá phần còn hoàn được → CHẶN ngay ở bước Amount', async () => {
    // Phần dư là 100.00; 150 sẽ ăn 422 ở server, và bày ra một con số biết
    // trước sẽ bị từ chối là để admin bấm rồi mới biết.
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: w.next }));
    await user.click(await screen.findByRole('button', { name: w.next }));
    await user.click(await screen.findByRole('radio', { name: w.amount.overrideOption }));
    await user.type(await screen.findByLabelText(w.amount.overrideLabel), '150');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: w.next })).toBeDisabled();
  });

  it('bỏ công tắc vượt bậc thì con số đã gõ KHÔNG lén đi theo payload', async () => {
    const user = userEvent.setup();
    const decide = vi
      .fn()
      .mockResolvedValue({ ok: true, approved: true, bookingCode: 'BK-ABCD1234' });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await open(user, 'approve');
    await user.click(await screen.findByRole('button', { name: w.next }));
    await user.click(await screen.findByRole('button', { name: w.next }));
    await user.click(await screen.findByRole('radio', { name: w.amount.overrideOption }));
    await user.type(await screen.findByLabelText(w.amount.overrideLabel), '75');
    await user.click(
      screen.getByRole('radio', { name: `${w.amount.policyOption} — $${POLICY_AMOUNT}` }),
    );
    await user.click(screen.getByRole('button', { name: w.next }));
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(decide).toHaveBeenCalledWith({
      id: REQUEST.id,
      approve: true,
      refundAmount: POLICY_AMOUNT,
    });
  });

  it('deny gửi approve: false kèm note đã trim — note đi vào email cho khách', async () => {
    const user = userEvent.setup();
    const decide = vi
      .fn()
      .mockResolvedValue({ ok: true, approved: false, bookingCode: 'BK-ABCD1234' });
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

  it('deny KHÔNG đi stepper và KHÔNG nói gì về tiền', async () => {
    const user = userEvent.setup();
    render(<DecideActions request={REQUEST} decide={vi.fn()} />);
    await open(user, 'deny');

    expect(await screen.findByText(t.denyDialog.body)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: w.steps.amount })).toBeNull();
    expect(screen.queryByText(t.refundAmount)).toBeNull();
  });
});

describe('DecideActions — kết quả server', () => {
  it('thành công: toast + đóng dialog + router.refresh kéo hàng đợi tươi', async () => {
    const user = userEvent.setup();
    const decide = vi
      .fn()
      .mockResolvedValue({ ok: true, approved: true, bookingCode: 'BK-ABCD1234' });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await openApproveToConfirm(user);
    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

    expect(success).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.approveDialog.warning)).toBeNull();
  });

  it('REFUND_FAILED (retryable duy nhất) hiện đúng câu và dialog Ở LẠI (bất biến §2.4)', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockResolvedValue({ ok: false, code: 'REFUND_FAILED' });
    render(<DecideActions request={REQUEST} decide={decide} />);
    await openApproveToConfirm(user);
    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.REFUND_FAILED);
    // Dialog còn mở, VÀ còn đứng ở bước Confirm: provider từ chối nhưng request
    // còn nguyên — thử lại tại chỗ là hợp lệ, ngữ cảnh + note giữ nguyên.
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lỗi TRẠNG-THÁI-CŨ (NOT_FOUND/ALREADY_DECIDED/NOT_REFUNDABLE): đóng + toast đúng câu + refresh', async () => {
    // Khoá chống tái hiện (review F3): copy hứa "the queue has been refreshed"
    // mà bản đầu không refresh — admin B bấm lặp vô hạn trên hàng đã quyết.
    // Hỏi CODEC thay vì lọc cứng theo tên (ADR-0029 §1 thêm hai mã tiền, và
    // chúng KHÔNG phải trạng-thái-cũ): danh sách stale chỉ có một nguồn.
    for (const code of [...DECIDE_CONTRACT_CODES].filter(isStaleStateCode)) {
      const user = userEvent.setup();
      const decide = vi.fn().mockResolvedValue({ ok: false, code });
      const view = render(<DecideActions request={REQUEST} decide={decide} />);
      await openApproveToConfirm(user);
      await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

      expect(errorToast).toHaveBeenCalledWith(t.errors[code]);
      expect(refresh).toHaveBeenCalled();
      expect(screen.queryByText(t.approveDialog.warning)).toBeNull();
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
    await openApproveToConfirm(user);
    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

    expect(errorToast).toHaveBeenCalledWith(messages.admin.errors.write.GENERIC);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.approveDialog.warning)).toBeNull();
  });

  it('action NÉM (mạng đứt) đối xử như GENERIC: đóng + toast + refresh', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockRejectedValue(new Error('boom'));
    render(<DecideActions request={REQUEST} decide={decide} />);
    await openApproveToConfirm(user);
    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

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
    await openApproveToConfirm(user);
    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

    await user.keyboard('{Escape}');
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();

    settle({ ok: false, code: 'REFUND_FAILED' });
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.REFUND_FAILED);
  });

  it('đang bắn thì KHÔNG lùi bước được — đổi ngữ cảnh giữa chừng là mất câu trả lời', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<DecideActions request={REQUEST} decide={decide} />);
    await openApproveToConfirm(user);
    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));

    expect(screen.getByRole('button', { name: w.back })).toBeDisabled();
    expect(screen.getByRole('tab', { name: w.steps.amount })).toBeDisabled();
  });

  it('bấm hai lần liên tiếp chỉ bắn MỘT lệnh — approve là money-path', async () => {
    const user = userEvent.setup();
    const decide = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<DecideActions request={REQUEST} decide={decide} />);
    await openApproveToConfirm(user);
    const submit = screen.getByRole('button', { name: t.approveDialog.submit });
    await user.click(submit);
    await user.click(submit);

    expect(decide).toHaveBeenCalledTimes(1);
  });
});
