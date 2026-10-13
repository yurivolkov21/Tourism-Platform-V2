import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toUserDetailVM } from '@/lib/users-view';
import { USER_ID, userDetailFixture } from '@/test/user-detail';
import { UserRoleAction } from './user-role-action';

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

describe('UserRoleAction', () => {
  it('khách đã xác minh: Grant → setRole STAFF, toast kể tên, trang làm tươi', async () => {
    const setRole = vi.fn(async () => ({ ok: true as const, role: 'STAFF' as const }));
    const user = userEvent.setup();
    render(<UserRoleAction detail={vm()} setRole={setRole} />);

    await user.click(screen.getByRole('button', { name: t.grant.action }));
    const dialog = await screen.findByRole('dialog', { name: t.grant.dialog.title });
    expect(within(dialog).getByText('ada@example.com')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.grant.dialog.submit }));

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.grant.toast.title, {
        description: t.grant.toast.body('Ada Lovelace'),
      }),
    );
    expect(setRole).toHaveBeenCalledWith({ id: USER_ID, role: 'STAFF' });
    expect(refresh).toHaveBeenCalled();
  });

  it('Staff: Revoke → setRole CUSTOMER; hộp nói rõ bị đăng xuất mọi nơi', async () => {
    const setRole = vi.fn(async () => ({ ok: true as const, role: 'CUSTOMER' as const }));
    const user = userEvent.setup();
    render(<UserRoleAction detail={vm({ role: 'STAFF' })} setRole={setRole} />);

    await user.click(screen.getByRole('button', { name: t.revoke.action }));
    const dialog = await screen.findByRole('dialog', { name: t.revoke.dialog.title });
    expect(within(dialog).getByText(t.revoke.dialog.warning)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.revoke.dialog.submit }));

    await waitFor(() => expect(setRole).toHaveBeenCalledWith({ id: USER_ID, role: 'CUSTOMER' }));
  });

  it('khách chưa xác minh hoặc đang khoá, và Owner: không có nút nào', () => {
    for (const patch of [
      { emailVerified: false, status: 'unverified' as const },
      { lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' as const },
      { role: 'ADMIN' as const },
    ]) {
      const { unmount } = render(<UserRoleAction detail={vm(patch)} setRole={vi.fn()} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('STATE_CHANGED (trạng-thái-cũ): đóng hộp, toast đúng câu, trang làm tươi', async () => {
    const setRole = vi.fn(async () => ({ ok: false as const, code: 'STATE_CHANGED' as const }));
    const user = userEvent.setup();
    render(<UserRoleAction detail={vm()} setRole={setRole} />);

    await user.click(screen.getByRole('button', { name: t.grant.action }));
    const dialog = await screen.findByRole('dialog', { name: t.grant.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.grant.dialog.submit }));

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(messages.admin.users.errors.STATE_CHANGED),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
