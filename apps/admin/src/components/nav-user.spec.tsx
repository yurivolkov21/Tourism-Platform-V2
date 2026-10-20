import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { SidebarProvider } from '@tourism/ui/components/sidebar';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider, useReportUnsaved } from '@/components/kit/unsaved-changes';
import type { SessionUser } from '@/lib/api/session';
import { NavUser } from './nav-user';

/**
 * Sign out của menu tài khoản khi khu làm việc còn bản nháp (review A2-17). Nút nằm ở sidebar
 * của shell, NGOÀI provider hỏi lại (provider bọc khu làm việc trong trang) và không phải link,
 * nên trước đây nó đăng xuất luôn, bỏ mất bản nháp mà không hỏi.
 */
const { push, signOut } = vi.hoisted(() => ({
  push: vi.fn(),
  signOut: vi.fn(async () => ({ data: { success: true }, error: null })),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/tours/ha-long/details',
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut } }));

const USER: SessionUser = {
  id: 'u-1',
  name: 'Admin Nexora',
  email: 'admin@nexora.test',
  role: 'ADMIN',
  image: null,
};

function Form({ dirty }: { dirty: boolean }) {
  useReportUnsaved(dirty);
  return <p>form</p>;
}

function Shell({ dirty }: { dirty: boolean }) {
  return (
    <SidebarProvider defaultOpen>
      <NavUser user={USER} />
      <UnsavedChangesProvider>
        <Form dirty={dirty} />
      </UnsavedChangesProvider>
    </SidebarProvider>
  );
}

async function clickSignOut(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('admin@nexora.test'));
  await user.click(await screen.findByRole('menuitem', { name: messages.admin.shell.signOut }));
}

beforeEach(() => {
  push.mockReset();
  signOut.mockClear();
});

describe('NavUser — Sign out', () => {
  it('còn bản nháp: hỏi trước; Keep editing thì ở lại, Discard changes mới đăng xuất', async () => {
    const user = userEvent.setup();
    render(<Shell dirty />);

    await clickSignOut(user);
    expect(
      await screen.findByRole('alertdialog', { name: messages.admin.unsavedChanges.title }),
    ).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.admin.unsavedChanges.keep }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(signOut).not.toHaveBeenCalled();

    await clickSignOut(user);
    await user.click(
      await screen.findByRole('button', { name: messages.admin.unsavedChanges.discard }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('không có bản nháp: đăng xuất ngay, không hỏi', async () => {
    const user = userEvent.setup();
    render(<Shell dirty={false} />);

    await clickSignOut(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
