import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toUserDetailVM } from '@/lib/users-view';
import { USER_ID, userDetailFixture } from '@/test/user-detail';
import { UserLockAction } from './user-lock-action';

const t = messages.admin.users.actions;

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

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

const vm = (patch: Parameters<typeof userDetailFixture>[0] = {}) =>
  toUserDetailVM(userDetailFixture(patch));

describe('UserLockAction', () => {
  it('chưa khoá: Lock bắt buộc lý do — trống thì không gửi', async () => {
    const lock = vi.fn(async () => ({ ok: true as const, lockedAt: '2026-10-02T03:00:00.000Z' }));
    const user = userEvent.setup();
    render(<UserLockAction detail={vm()} lock={lock} unlock={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: t.lock.action }));
    const dialog = await screen.findByRole('dialog', { name: t.lock.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.lock.dialog.submit }));

    expect(await within(dialog).findByText(t.lock.dialog.noteRequired)).toBeInTheDocument();
    expect(lock).not.toHaveBeenCalled();
  });

  it('chưa khoá: có lý do → lock({ id, reason }), toast kể tên', async () => {
    const lock = vi.fn(async () => ({ ok: true as const, lockedAt: '2026-10-02T03:00:00.000Z' }));
    const user = userEvent.setup();
    render(<UserLockAction detail={vm()} lock={lock} unlock={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: t.lock.action }));
    const dialog = await screen.findByRole('dialog', { name: t.lock.dialog.title });
    await user.type(within(dialog).getByLabelText(t.lock.dialog.noteLabel), 'Chargeback abuse');
    await user.click(within(dialog).getByRole('button', { name: t.lock.dialog.submit }));

    await waitFor(() =>
      expect(lock).toHaveBeenCalledWith({ id: USER_ID, reason: 'Chargeback abuse' }),
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.lock.toast.title, {
        description: t.lock.toast.body('Ada Lovelace'),
      }),
    );
  });

  it('đang khoá: Unlock, không ô lý do → unlock({ id })', async () => {
    const unlock = vi.fn(async () => ({ ok: true as const }));
    const user = userEvent.setup();
    render(
      <UserLockAction
        detail={vm({ lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' })}
        lock={vi.fn()}
        unlock={unlock}
      />,
    );

    expect(screen.queryByRole('button', { name: t.lock.action })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.unlock.action }));
    const dialog = await screen.findByRole('dialog', { name: t.unlock.dialog.title });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.unlock.dialog.submit }));

    await waitFor(() => expect(unlock).toHaveBeenCalledWith({ id: USER_ID }));
  });

  it('Owner không khoá: không nút; Owner đang khoá: có nút Unlock', () => {
    const { unmount } = render(
      <UserLockAction detail={vm({ role: 'ADMIN' })} lock={vi.fn()} unlock={vi.fn()} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();

    render(
      <UserLockAction
        detail={vm({ role: 'ADMIN', lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' })}
        lock={vi.fn()}
        unlock={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: t.unlock.action })).toBeInTheDocument();
  });
});

describe('UserLockAction — focus khi trang làm mới (khuôn G6)', () => {
  it('lệnh xong, hộp đóng lúc trang còn làm mới: focus về nút đang khoá, bấm cũng không mở gì', async () => {
    // Lượt làm mới treo: transition giữ nút khoá suốt ca.
    refresh.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(
      <UserLockAction
        detail={vm({ lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' })}
        lock={vi.fn()}
        unlock={vi.fn(async () => ({ ok: true as const }))}
      />,
    );

    await user.click(screen.getByRole('button', { name: t.unlock.action }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: t.unlock.dialog.submit }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const button = screen.getByRole('button', { name: t.unlock.action });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('disabled');
    await waitFor(() => expect(button).toHaveFocus());

    await user.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
