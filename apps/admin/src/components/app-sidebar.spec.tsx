import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarProvider } from '@tourism/ui/components/sidebar';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/api/session';
import { SIDEBAR_STATE_COOKIE, sidebarOpenFromCookie } from '@/lib/sidebar-state';
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

// Cookie của jsdom sống qua các test trong file — xoá để ca sau không đọc nhầm.
afterEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: SidebarProvider ghi cookie qua document.cookie, xoá bằng đúng đường đó; jsdom không có Cookie Store API.
  document.cookie = `${SIDEBAR_STATE_COOKIE}=; path=/; max-age=0`;
});

describe('AppSidebar', () => {
  it('thu gọn thì thành cột icon (collapsible="icon"), không trượt mất', () => {
    renderSidebar({ open: false });

    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    expect(sidebar).toHaveAttribute('data-collapsible', 'icon');
  });

  it('thu gọn: rê vào logo thì tooltip nói nó dẫn về đâu — bật ngay, không trễ', async () => {
    const user = userEvent.setup();
    renderSidebar({ open: false });

    await user.hover(screen.getByRole('link', { name: 'Nexora' }));

    // `getBy` chứ không `findBy`: ở cột icon tooltip là nhãn duy nhất nên phải bật
    // NGAY (`TooltipProvider` của sidebar, delay 0). Thiếu provider thì Base UI trễ
    // 600ms, mà `findBy` chờ tới 1s nên không phân biệt được hai trường hợp.
    expect(screen.getByText('Nexora — Dashboard')).toBeInTheDocument();
  });

  it('thu gọn: rê vào avatar thì tooltip nói tên người đang đăng nhập', async () => {
    const user = userEvent.setup();
    renderSidebar({ open: false });
    expect(visibleText('Admin Nexora')).toHaveLength(1);

    await user.hover(screen.getByRole('button', { name: /Admin Nexora/ }));

    // Một ở nút (ẩn trong cột icon), một ở tooltip.
    await waitFor(() => expect(visibleText('Admin Nexora')).toHaveLength(2));
  });

  it('thu gọn (Ctrl+B) thì ghi đúng cookie mà shell đọc lại khi dựng trang kế', async () => {
    const user = userEvent.setup();
    renderSidebar({ open: true });

    await user.keyboard('{Control>}b{/Control}');

    expect(document.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
      'data-state',
      'collapsed',
    );
    // Tên cookie chép tay ở `lib/sidebar-state.ts` vì gói ui không export hằng của
    // nó — test này canh hai bên khớp nhau.
    const written = document.cookie
      .split('; ')
      .find((pair) => pair.startsWith(`${SIDEBAR_STATE_COOKIE}=`))
      ?.split('=')[1];
    expect(sidebarOpenFromCookie(written)).toBe(false);
  });
});
