import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OUTBOX_MAX_ATTEMPTS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboxRowVM } from '@/lib/outbox-view';
import { RetryAction } from './retry-action';

/**
 * Nút Retry của một hàng FAILED trong `/outbox` (spec P4c §3-F7) — consumer
 * thứ ba của `ConfirmWriteDialog`, và là consumer đầu tiên KHÔNG có ô note.
 * Vòng đời lệnh ghi đã pin ở spec của kit; ở đây pin phần DOMAIN: dialog nêu
 * đúng hệ quả (về hàng đợi, worker ~1 phút, lastError giữ lại), input gửi đi
 * chỉ có `id`, và toast gọi đúng dedupeKey.
 */
const t = messages.admin.outbox.retry;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

/** Nút nhận NGUYÊN VM của hàng (vòng vá review F7) — dựng đủ, không cắt subset. */
const ROW: OutboxRowVM = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'BOOKING_CONFIRMATION',
  typeLabel: messages.admin.outbox.type.BOOKING_CONFIRMATION,
  recipient: 'ada@example.com',
  status: 'FAILED',
  statusLabel: messages.admin.outbox.status.FAILED,
  attempts: OUTBOX_MAX_ATTEMPTS,
  attemptsLabel: `${OUTBOX_MAX_ATTEMPTS}/${OUTBOX_MAX_ATTEMPTS}`,
  lastError: 'Resend: 401 invalid api key',
  created: '1 Sep 2026, 10:00 UTC',
  processed: null,
  dedupeKey: 'booking-confirmed:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  payload: { code: 'BK-ABCD1234', email: 'ada@example.com' },
  retried: false,
  canRetry: true,
};

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: t.actionLabel(ROW.dedupeKey) }));
}

describe('RetryAction — nút và dialog', () => {
  it('nút mang tên riêng theo dedupeKey; mở dialog KHÔNG bắn gì', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<RetryAction row={ROW} retry={retry} />);
    await open(user);
    expect(await screen.findByText(t.dialog.title)).toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();
  });

  it('dialog nêu ba hệ quả, cảnh báo mang trần attempts, ngữ cảnh hàng và KHÔNG có ô note', async () => {
    const user = userEvent.setup();
    render(<RetryAction row={ROW} retry={vi.fn()} />);
    await open(user);

    expect(await screen.findByText(t.dialog.consequences.requeue)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.consequences.worker)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.consequences.lastError)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.warning(OUTBOX_MAX_ATTEMPTS))).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Resend: 401 invalid api key')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('xác nhận gửi ĐÚNG { id } — không note, không field thừa', async () => {
    const user = userEvent.setup();
    const retry = vi.fn(async () => ({ ok: true as const, dedupeKey: ROW.dedupeKey }));
    render(<RetryAction row={ROW} retry={retry} />);
    await open(user);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));
    expect(retry).toHaveBeenCalledWith({ id: ROW.id });
  });

  it('thành công: toast gọi đúng dedupeKey + đóng dialog + refresh bảng', async () => {
    const user = userEvent.setup();
    const retry = vi.fn(async () => ({ ok: true as const, dedupeKey: ROW.dedupeKey }));
    render(<RetryAction row={ROW} retry={retry} />);
    await open(user);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(success).toHaveBeenCalledWith(t.toast.title, {
      description: t.toast.body(ROW.dedupeKey),
    });
    expect(screen.queryByText(t.dialog.title)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('NOT_FAILED (trạng-thái-cũ): đóng + toast đúng câu + refresh', async () => {
    const user = userEvent.setup();
    const retry = vi.fn(async () => ({ ok: false as const, code: 'NOT_FAILED' as const }));
    render(<RetryAction row={ROW} retry={retry} />);
    await open(user);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(errorToast).toHaveBeenCalledWith(t.errors.NOT_FAILED);
    expect(screen.queryByText(t.dialog.title)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('hết phiên (UNAUTHORIZED): dialog Ở LẠI kèm câu đăng nhập lại', async () => {
    const user = userEvent.setup();
    const retry = vi.fn(async () => ({ ok: false as const, code: 'UNAUTHORIZED' as const }));
    render(<RetryAction row={ROW} retry={retry} />);
    await open(user);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.errors.write.UNAUTHORIZED,
    );
    expect(screen.getByText(t.dialog.title)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
