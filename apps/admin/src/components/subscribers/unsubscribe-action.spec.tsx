import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '@/lib/bookings-view';
import type { SubscriberRowVM } from '@/lib/subscribers-view';
import { UnsubscribeAction } from './unsubscribe-action';

/**
 * Nút Unsubscribe của một hàng còn nhận tin trong `/subscribers` (spec P4c
 * §3-F10). Vòng đời lệnh ghi đã pin ở spec của kit `ConfirmWriteDialog`; ở
 * đây pin phần DOMAIN: dialog nêu đúng ba hệ quả (kể cả "không đăng ký lại hộ
 * được"), địa chỉ hiện ra để đọc lại trước khi bấm, input gửi đi chỉ có `id`,
 * và toast kể lại MỐC server vừa ghi.
 */
const t = messages.admin.subscribers.unsubscribe;

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

const UNSUBSCRIBED_AT = '2026-09-03T09:15:00.000Z';

/** Nút nhận NGUYÊN VM của hàng — dựng đủ, không cắt subset. */
const ROW: SubscriberRowVM = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ada@example.com',
  source: 'footer',
  subscribed: '1 Sep 2026, 10:00 UTC',
  unsubscribed: messages.admin.subscribers.list.stillSubscribed,
  isActive: true,
};

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: t.actionLabel(ROW.email) }));
}

describe('UnsubscribeAction — nút và dialog', () => {
  it('nút mang tên riêng theo địa chỉ; mở dialog KHÔNG bắn gì', async () => {
    const user = userEvent.setup();
    const unsubscribe = vi.fn();
    render(<UnsubscribeAction row={ROW} unsubscribe={unsubscribe} />);
    await open(user);
    expect(await screen.findByText(t.dialog.title)).toBeInTheDocument();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('dialog nêu ba hệ quả — kể cả việc admin KHÔNG đăng ký lại hộ được', async () => {
    const user = userEvent.setup();
    render(<UnsubscribeAction row={ROW} unsubscribe={vi.fn()} />);
    await open(user);

    expect(await screen.findByText(t.dialog.consequences.stops)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.consequences.kept)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.consequences.oneWay)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.warning)).toBeInTheDocument();
  });

  it('ngữ cảnh nêu rõ ĐỊA CHỈ và ngày đăng ký; KHÔNG có ô note', async () => {
    const user = userEvent.setup();
    render(<UnsubscribeAction row={ROW} unsubscribe={vi.fn()} />);
    await open(user);

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 Sep 2026, 10:00 UTC')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('xác nhận gửi ĐÚNG { id } — không note, không field thừa', async () => {
    const user = userEvent.setup();
    const unsubscribe = vi.fn(async () => ({
      ok: true as const,
      unsubscribedAt: UNSUBSCRIBED_AT,
    }));
    render(<UnsubscribeAction row={ROW} unsubscribe={unsubscribe} />);
    await open(user);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));
    expect(unsubscribe).toHaveBeenCalledWith({ id: ROW.id });
  });

  it('thành công: toast kể MỐC server vừa ghi + đóng dialog + refresh bảng', async () => {
    const user = userEvent.setup();
    const unsubscribe = vi.fn(async () => ({
      ok: true as const,
      unsubscribedAt: UNSUBSCRIBED_AT,
    }));
    render(<UnsubscribeAction row={ROW} unsubscribe={unsubscribe} />);
    await open(user);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(success).toHaveBeenCalledWith(t.toast.title, {
      description: t.toast.body(ROW.email, formatDateTime(UNSUBSCRIBED_AT)),
    });
    expect(screen.queryByText(t.dialog.title)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('ALREADY_UNSUBSCRIBED (trạng-thái-cũ): đóng + toast đúng câu + refresh', async () => {
    const user = userEvent.setup();
    const unsubscribe = vi.fn(async () => ({
      ok: false as const,
      code: 'ALREADY_UNSUBSCRIBED' as const,
    }));
    render(<UnsubscribeAction row={ROW} unsubscribe={unsubscribe} />);
    await open(user);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(errorToast).toHaveBeenCalledWith(t.errors.ALREADY_UNSUBSCRIBED);
    expect(screen.queryByText(t.dialog.title)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('hết phiên (UNAUTHORIZED): dialog Ở LẠI kèm câu đăng nhập lại', async () => {
    const user = userEvent.setup();
    const unsubscribe = vi.fn(async () => ({
      ok: false as const,
      code: 'UNAUTHORIZED' as const,
    }));
    render(<UnsubscribeAction row={ROW} unsubscribe={unsubscribe} />);
    await open(user);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.errors.write.UNAUTHORIZED,
    );
    expect(screen.getByText(t.dialog.title)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
