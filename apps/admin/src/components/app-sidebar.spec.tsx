import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarProvider } from '@tourism/ui/components/sidebar';
import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/api/session';
import { AppSidebar } from './app-sidebar';

/**
 * Sidebar của shell (góp ý giao diện 28/09, demo đã duyệt): thu gọn thì thành cột
 * icon chứ không trượt mất hẳn — trước đây `collapsible="offcanvas"` làm trang mất
 * mọi nút điều hướng.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }));

const USER: SessionUser = {
  id: 'u-1',
  name: 'Admin Nexora',
  email: 'admin@nexora.test',
  role: 'ADMIN',
  image: null,
};

function renderSidebar({ open }: { open: boolean }) {
  return render(
    <SidebarProvider defaultOpen={open}>
      <AppSidebar user={USER} />
    </SidebarProvider>,
  );
}

const visibleText = (text: string) =>
  screen.getAllByText(text).filter((node) => node.closest('[hidden]') === null);

describe('AppSidebar', () => {
  it('thu gọn thì thành cột icon (collapsible="icon"), không trượt mất', () => {
    renderSidebar({ open: false });

    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    expect(sidebar).toHaveAttribute('data-collapsible', 'icon');
  });

  it('thu gọn: rê vào logo thì tooltip nói nó dẫn về đâu', async () => {
    const user = userEvent.setup();
    renderSidebar({ open: false });

    await user.hover(screen.getByRole('link', { name: 'Nexora' }));

    expect(await screen.findByText('Nexora — Dashboard')).toBeInTheDocument();
  });

  it('thu gọn: rê vào avatar thì tooltip nói tên người đang đăng nhập', async () => {
    const user = userEvent.setup();
    renderSidebar({ open: false });
    expect(visibleText('Admin Nexora')).toHaveLength(1);

    await user.hover(screen.getByRole('button', { name: /Admin Nexora/ }));

    // Một ở nút (ẩn trong cột icon), một ở tooltip.
    await waitFor(() => expect(visibleText('Admin Nexora')).toHaveLength(2));
  });
});
