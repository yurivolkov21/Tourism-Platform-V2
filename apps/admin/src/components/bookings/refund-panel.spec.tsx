import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REFUND_FAILURE_CODES } from '@/lib/refund';
import { RefundPanel, type RefundTarget } from './refund-panel';

const t = messages.admin.bookings.refund;

const success = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...args: unknown[]) => success(...args) } }));

const PAID: RefundTarget = {
  code: 'BK-ABCD1234',
  status: 'PAID',
  totalAmount: '120.00',
  currency: 'USD',
  contactName: 'Ada Lovelace',
};

beforeEach(() => {
  success.mockReset();
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

  it('mode partial gửi đúng amount + reason đã gõ', async () => {
    const user = userEvent.setup();
    const refund = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 'PARTIALLY_REFUNDED', refunds: [] });
    render(<RefundPanel booking={PAID} refund={refund} />);

    await user.click(screen.getByRole('button', { name: t.cta }));
    await user.click(await screen.findByRole('radio', { name: t.form.modePartial }));
    await user.type(screen.getByLabelText(t.form.amountLabel), '40.50');
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

  it('vượt total → câu có số tiền trần, vẫn ở bước 1', async () => {
    const user = userEvent.setup();
    const refund = vi.fn();
    render(<RefundPanel booking={PAID} refund={refund} />);

    await user.click(screen.getByRole('button', { name: t.cta }));
    await user.click(await screen.findByRole('radio', { name: t.form.modePartial }));
    await user.type(screen.getByLabelText(t.form.amountLabel), '999');
    await user.click(screen.getByRole('button', { name: t.form.next }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.validation.overTotal('$120.00'));
    expect(refund).not.toHaveBeenCalled();
  });
});

describe('RefundPanel — kết quả server', () => {
  it('thành công: sổ cái THẬT hiện ra + tổng cộng + refresh trang', async () => {
    const user = userEvent.setup();
    const refund = vi.fn().mockResolvedValue({
      ok: true,
      status: 'PARTIALLY_REFUNDED',
      refunds: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          amount: '40.50',
          currency: 'USD',
          providerRefundId: 're_test_1',
          adminId: '22222222-2222-4222-8222-222222222222',
          createdAt: '2026-08-30T09:30:00.000Z',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          amount: '9.50',
          currency: 'USD',
          providerRefundId: null,
          adminId: null,
          createdAt: '2026-08-31T10:00:00.000Z',
        },
      ],
    });
    render(<RefundPanel booking={PAID} refund={refund} />);
    await openConfirmStep(user);
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    const ledger = await screen.findByRole('table', { name: t.ledger.heading });
    expect(within(ledger).getByText('$40.50')).toBeInTheDocument();
    expect(within(ledger).getByText('re_test_1')).toBeInTheDocument();
    expect(screen.getByText(t.ledger.total('$50.00'))).toBeInTheDocument();
    // Làm tươi trang là việc của server action (`refresh()` của next/cache,
    // xem `actions.ts`) — panel chỉ chịu trách nhiệm toast + sổ cái.
    expect(success).toHaveBeenCalled();
  });

  it('chưa refund lần nào trong phiên → câu giải thích theo trạng thái, KHÔNG bịa số', () => {
    render(<RefundPanel booking={PAID} refund={vi.fn()} />);
    expect(screen.getByText(t.ledger.none)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('PARTIALLY_REFUNDED: nói có refund nhưng KHÔNG in số (byCode không trả sổ)', () => {
    render(<RefundPanel booking={{ ...PAID, status: 'PARTIALLY_REFUNDED' }} refund={vi.fn()} />);
    expect(screen.getByText(t.ledger.onRecord)).toBeInTheDocument();
  });

  it('mỗi mã lỗi server hiện ĐÚNG câu của nó trong dialog (bất biến §2.4)', async () => {
    for (const code of REFUND_FAILURE_CODES) {
      const user = userEvent.setup();
      const refund = vi.fn().mockResolvedValue({ ok: false, code });
      const view = render(<RefundPanel booking={PAID} refund={refund} />);
      await openConfirmStep(user);
      await user.click(screen.getByRole('button', { name: t.confirm.submit }));

      expect(await screen.findByRole('alert')).toHaveTextContent(t.errors[code]);
      // Lỗi thì KHÔNG toast thành công và dialog vẫn mở (chữ đã gõ còn nguyên).
      expect(success).not.toHaveBeenCalled();
      view.unmount();
    }
  });
});
