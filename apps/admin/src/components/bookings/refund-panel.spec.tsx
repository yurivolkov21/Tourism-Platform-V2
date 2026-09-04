import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REFUND_CONTRACT_CODES } from '@/lib/refund';
import { RefundPanel, type RefundTarget } from './refund-panel';

const t = messages.admin.bookings.refund;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

// Panel gọi `router.refresh()` sau mọi kết cục đã chạm server (vòng vá review
// 31/08) — mock để đếm được.
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

const PAID: RefundTarget = {
  code: 'BK-ABCD1234',
  status: 'PAID',
  totalAmount: '120.00',
  refundedTotal: '0.00',
  hasOpenCancellation: false,
  currency: 'USD',
  contactName: 'Ada Lovelace',
  refunds: [],
};

const REFUND_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  amount: '40.50',
  currency: 'USD',
  providerRefundId: 're_test_1',
  adminId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-08-30T09:30:00.000Z',
};

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

/** Mở dialog và đi qua bước 1 (mặc định: full) tới bước 2. */
async function openConfirmStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: t.cta }));
  await user.click(await screen.findByRole('button', { name: t.form.next }));
}

describe('RefundPanel — cổng trạng thái', () => {
  it('PAID có nút refund', () => {
    render(<RefundPanel booking={PAID} refund={vi.fn()} />);
    expect(screen.getByRole('button', { name: t.cta })).toBeInTheDocument();
  });

  it('PENDING không có nút, thay bằng câu giải thích', () => {
    render(<RefundPanel booking={{ ...PAID, status: 'PENDING' }} refund={vi.fn()} />);
    expect(screen.queryByRole('button', { name: t.cta })).not.toBeInTheDocument();
    expect(screen.getByText(t.unavailable)).toBeInTheDocument();
  });

  it('REFUNDED (đã settle) cũng không có nút', () => {
    render(<RefundPanel booking={{ ...PAID, status: 'REFUNDED' }} refund={vi.fn()} />);
    expect(screen.queryByRole('button', { name: t.cta })).not.toBeInTheDocument();
  });
});

describe('RefundPanel — sổ cái từ PROPS (byCode trả ledger thật, review 31/08)', () => {
  it('có refund row → bảng hiện ngay khi mở trang, tổng là refundedTotal server', () => {
    render(
      <RefundPanel
        booking={{
          ...PAID,
          status: 'PARTIALLY_REFUNDED',
          refundedTotal: '40.50',
          refunds: [REFUND_ROW],
        }}
        refund={vi.fn()}
      />,
    );
    const ledger = screen.getByRole('table', { name: t.ledger.heading });
    expect(within(ledger).getByText('$40.50')).toBeInTheDocument();
    expect(within(ledger).getByText('re_test_1')).toBeInTheDocument();
    // Tổng in từ `refundedTotal` server aggregate — client không tự cộng.
    expect(screen.getByText(t.ledger.total('$40.50'))).toBeInTheDocument();
  });

  it('bảng rỗng → câu "No refunds" — giờ là sự thật từ DB, không phải phỏng đoán', () => {
    render(<RefundPanel booking={PAID} refund={vi.fn()} />);
    expect(screen.getByText(t.ledger.none)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('RefundPanel — confirm 2 bước', () => {
  it('bước 1 KHÔNG bắn gì: phải qua bước 2 rồi bấm "Refund now"', async () => {
    const user = userEvent.setup();
    const refund = vi.fn().mockResolvedValue({ ok: true, status: 'REFUNDED', refunds: [] });
    render(<RefundPanel booking={PAID} refund={refund} />);

    await user.click(screen.getByRole('button', { name: t.cta }));
    expect(await screen.findByText(t.form.body)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.form.next }));
    expect(refund).not.toHaveBeenCalled();

    expect(await screen.findByText(t.confirm.warning)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it('nút Back đưa về bước 1, chưa bắn gì', async () => {
    const user = userEvent.setup();
    const refund = vi.fn();
    render(<RefundPanel booking={PAID} refund={refund} />);
    await openConfirmStep(user);

    await user.click(screen.getByRole('button', { name: t.confirm.back }));
    expect(await screen.findByText(t.form.body)).toBeInTheDocument();
    expect(refund).not.toHaveBeenCalled();
  });

  it('mode full gửi input KHÔNG có amount — server tự tính phần còn lại', async () => {
    const user = userEvent.setup();
    const refund = vi.fn().mockResolvedValue({ ok: true, status: 'REFUNDED', refunds: [] });
    render(<RefundPanel booking={PAID} refund={refund} />);
    await openConfirmStep(user);
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(refund).toHaveBeenCalledWith({ code: 'BK-ABCD1234' });
  });

  it('mode partial gửi đúng amount + reason; dấu phẩy thập phân được chuẩn hoá', async () => {
    const user = userEvent.setup();
    const refund = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 'PARTIALLY_REFUNDED', refunds: [] });
    render(<RefundPanel booking={PAID} refund={refund} />);

    await user.click(screen.getByRole('button', { name: t.cta }));
    await user.click(await screen.findByRole('radio', { name: t.form.modePartial }));
    // Bàn phím decimal non-US phát dấu phẩy — form phải hiểu, không bắt học lại.
    await user.type(screen.getByLabelText(t.form.amountLabel), '40,50');
    await user.type(screen.getByLabelText(t.form.reasonLabel), 'Guide cancelled a day');
    await user.click(screen.getByRole('button', { name: t.form.next }));
    await user.click(await screen.findByRole('button', { name: t.confirm.submit }));

    expect(refund).toHaveBeenCalledWith({
      code: 'BK-ABCD1234',
      amount: '40.50',
      reason: 'Guide cancelled a day',
    });
  });
});

describe('RefundPanel — validate client (chặn trước khi bắn)', () => {
  it('partial để trống → lỗi tại chỗ, KHÔNG sang bước 2', async () => {
    const user = userEvent.setup();
    const refund = vi.fn();
    render(<RefundPanel booking={PAID} refund={refund} />);

    await user.click(screen.getByRole('button', { name: t.cta }));
    await user.click(await screen.findByRole('radio', { name: t.form.modePartial }));
    await user.click(screen.getByRole('button', { name: t.form.next }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.validation.required);
    expect(screen.queryByText(t.confirm.warning)).not.toBeInTheDocument();
    expect(refund).not.toHaveBeenCalled();
  });

  it('trần là phần CÒN HOÀN ĐƯỢC (total − refundedTotal), không phải total', async () => {
    const user = userEvent.setup();
    const refund = vi.fn();
    render(
      <RefundPanel
        booking={{ ...PAID, status: 'PARTIALLY_REFUNDED', refundedTotal: '20.00' }}
        refund={refund}
      />,
    );

    await user.click(screen.getByRole('button', { name: t.cta }));
    await user.click(await screen.findByRole('radio', { name: t.form.modePartial }));
    // 110 < total 120 nhưng > remaining 100 — bản cũ cho qua để server trả
    // OVER_TOTAL; giờ chặn ngay tại form (vòng vá review 31/08).
    await user.type(screen.getByLabelText(t.form.amountLabel), '110');
    await user.click(screen.getByRole('button', { name: t.form.next }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.validation.overRemaining('$100.00'),
    );
    expect(refund).not.toHaveBeenCalled();
  });

  it('lỗi validate TỰ BIẾN khi gõ sửa input — không treo câu cũ (review 31/08)', async () => {
    const user = userEvent.setup();
    render(<RefundPanel booking={PAID} refund={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: t.cta }));
    await user.click(await screen.findByRole('radio', { name: t.form.modePartial }));
    await user.click(screen.getByRole('button', { name: t.form.next }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.validation.required);

    // Gõ một số hợp lệ: câu lỗi phải biến NGAY (derived), không chờ bấm nút.
    await user.type(screen.getByLabelText(t.form.amountLabel), '10');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('RefundPanel — kết quả server', () => {
  it('thành công: toast + đóng dialog + router.refresh kéo sổ cái tươi', async () => {
    const user = userEvent.setup();
    const refund = vi.fn().mockResolvedValue({
      ok: true,
      status: 'PARTIALLY_REFUNDED',
      refunds: [REFUND_ROW],
    });
    render(<RefundPanel booking={PAID} refund={refund} />);
    await openConfirmStep(user);
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(success).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.confirm.warning)).not.toBeInTheDocument();
  });

  it('mỗi mã contract hiện ĐÚNG câu của nó, dialog Ở LẠI cho sửa tại chỗ (bất biến §2.4)', async () => {
    for (const code of REFUND_CONTRACT_CODES) {
      const user = userEvent.setup();
      const refund = vi.fn().mockResolvedValue({ ok: false, code });
      const view = render(<RefundPanel booking={PAID} refund={refund} />);
      await openConfirmStep(user);
      await user.click(screen.getByRole('button', { name: t.confirm.submit }));

      expect(await screen.findByRole('alert')).toHaveTextContent(t.errors[code]);
      expect(success).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it('câu lỗi contract VẪN hiện sau khi bấm Back về bước 1... rồi mới xoá khi đổi input', async () => {
    // Khoá chống tái hiện: bản đầu chỉ render lỗi ở bước confirm — bấm Back
    // là câu lỗi bốc hơi. Giờ khối lỗi đứng ngoài hai bước.
    const user = userEvent.setup();
    const refund = vi.fn().mockResolvedValue({ ok: false, code: 'NOT_REFUNDABLE' });
    render(<RefundPanel booking={PAID} refund={refund} />);
    await openConfirmStep(user);
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.NOT_REFUNDABLE);
  });

  it('kết cục KHÔNG RÕ (GENERIC): đóng dialog + toast lỗi + refresh — không mời bấm lại mù', async () => {
    // Khoá chống refund đúp (review 31/08): sau lỗi mập mờ, admin phải nhìn
    // sổ cái tươi trước khi cân nhắc thử lại — không có nút "Refund now"
    // đứng sẵn nạp đạn.
    const user = userEvent.setup();
    const refund = vi.fn().mockResolvedValue({ ok: false, code: 'GENERIC' });
    render(<RefundPanel booking={PAID} refund={refund} />);
    await openConfirmStep(user);
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(errorToast).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.confirm.warning)).not.toBeInTheDocument();
  });

  it('action NÉM (mạng đứt) đối xử như GENERIC: đóng + toast + refresh', async () => {
    const user = userEvent.setup();
    const refund = vi.fn().mockRejectedValue(new Error('boom'));
    render(<RefundPanel booking={PAID} refund={refund} />);
    await openConfirmStep(user);
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(errorToast).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('đang bắn thì Esc KHÔNG đóng được dialog — lỗi về sau không được phép tàng hình', async () => {
    const user = userEvent.setup();
    let resolveRefund: (value: { ok: false; code: 'NOT_REFUNDABLE' }) => void = () => {};
    const refund = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefund = resolve as typeof resolveRefund;
        }),
    );
    render(<RefundPanel booking={PAID} refund={refund} />);
    await openConfirmStep(user);
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    // Đang pending: Escape bị nuốt, dialog còn nguyên.
    await user.keyboard('{Escape}');
    expect(screen.getByText(t.confirm.warning)).toBeInTheDocument();

    // Kết quả về: câu lỗi hiện trong dialog vẫn đang mở.
    resolveRefund({ ok: false, code: 'NOT_REFUNDABLE' });
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.NOT_REFUNDABLE);
  });
});

/**
 * ADR-0029 §AMEND — chặn ca chồng lấn tại nguồn: booking đang có yêu cầu huỷ
 * chờ xử lý thì nút refund ẨN, vì đường đúng là Approve (chỉ nó nhả ghế).
 */
describe('RefundPanel — booking có yêu cầu huỷ đang mở', () => {
  it('KHÔNG hiện nút refund, và nói rõ đường đúng thay vì im lặng tắt', () => {
    render(<RefundPanel booking={{ ...PAID, hasOpenCancellation: true }} refund={vi.fn()} />);

    expect(screen.queryByRole('button', { name: t.issue })).toBeNull();
    // Một nút biến mất không lý do là một admin đi tìm cách khác — mà cách
    // khác ở đây chính là cái bẫy làm rò ghế.
    expect(screen.getByText(messages.admin.bookings.refund.openCancellation)).toBeInTheDocument();
  });

  it('không có request mở thì nút vẫn hiện như cũ', () => {
    render(<RefundPanel booking={PAID} refund={vi.fn()} />);
    expect(screen.getByRole('button', { name: t.issue })).toBeInTheDocument();
  });
});
