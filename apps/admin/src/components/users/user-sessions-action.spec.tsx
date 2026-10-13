import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toUserDetailVM } from '@/lib/users-view';
import { USER_ID, userDetailFixture } from '@/test/user-detail';
import { UserSessionsAction } from './user-sessions-action';

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

describe('UserSessionsAction', () => {
  it('có phiên: Sign out everywhere → revokeSessions({ id }), toast kể số phiên đã kết thúc', async () => {
    const revokeSessions = vi.fn(async () => ({ ok: true as const, revoked: 2 }));
    const user = userEvent.setup();
    render(<UserSessionsAction detail={vm()} revokeSessions={revokeSessions} />);

    await user.click(screen.getByRole('button', { name: t.sessions.action }));
    const dialog = await screen.findByRole('dialog', { name: t.sessions.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.sessions.dialog.submit }));

    await waitFor(() => expect(revokeSessions).toHaveBeenCalledWith({ id: USER_ID }));
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.sessions.toast.title, {
        description: t.sessions.toast.body(2),
      }),
    );
  });

  it('không phiên nào: nút tắt', () => {
    render(
      <UserSessionsAction
        detail={vm({ sessions: { active: 0, lastActiveAt: null } })}
        revokeSessions={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: t.sessions.action })).toBeDisabled();
  });

  it('Owner: không có nút', () => {
    render(<UserSessionsAction detail={vm({ role: 'ADMIN' })} revokeSessions={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('UserSessionsAction — focus sau lệnh ghi', () => {
  it('lệnh xong, trang làm mới về 0 phiên: nút khoá kiểu aria-disabled và GIỮ focus', async () => {
    // Đo Chromium 13/10: hộp đóng trả focus về nút, rồi nút tắt thật (đang làm mới, rồi hết
    // phiên) và focus rơi về <body>.
    const revokeSessions = vi.fn(async () => ({ ok: true as const, revoked: 2 }));
    const user = userEvent.setup();
    const { rerender } = render(
      <UserSessionsAction detail={vm()} revokeSessions={revokeSessions} />,
    );

    await user.click(screen.getByRole('button', { name: t.sessions.action }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: t.sessions.dialog.submit }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const button = screen.getByRole('button', { name: t.sessions.action });
    await waitFor(() => expect(button).toHaveFocus());

    // Lượt làm mới mang về chi tiết mới: không còn phiên nào.
    rerender(
      <UserSessionsAction
        detail={vm({ sessions: { active: 0, lastActiveAt: null } })}
        revokeSessions={revokeSessions}
      />,
    );

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('disabled');
    expect(button).toHaveFocus();
    await user.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
