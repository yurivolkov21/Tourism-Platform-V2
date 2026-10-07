import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { SidebarProvider } from '@tourism/ui/components/sidebar';
import { TooltipProvider } from '@tourism/ui/components/tooltip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourEditorOptions } from '@/lib/api/tours';
import { QuickCreateMenu } from './quick-create-menu';
import { NewTourDialog } from './tours/editor/new-tour-dialog';

const { navigate, location } = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { pathname: '/bookings' },
}));
vi.mock('next/link', async () => (await import('@/test/next-link')).nextLinkMock(navigate));
vi.mock('next/navigation', () => ({
  usePathname: () => location.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  navigate.mockReset();
  location.pathname = '/bookings';
});

const t = messages.admin.shell;
const newTour = messages.admin.tours.editor.create;
const OPTIONS: TourEditorOptions = { categories: [], destinations: [] };

function renderMenu({ open }: { open: boolean }) {
  return render(
    <TooltipProvider>
      <SidebarProvider defaultOpen={open}>
        <QuickCreateMenu />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

/** Tooltip ẩn vẫn nằm trong DOM (mang `hidden`) — chỉ đếm chữ đang hiện. */
const visibleText = (text: string) =>
  screen.getAllByText(text).filter((node) => node.closest('[hidden]') === null);

/**
 * Quick Create (spec 2026-10-05 §2.5): bốn mục, mỗi mục mở hộp tạo của một vùng. Cơ chế là yêu
 * cầu phía client (`lib/quick-create.ts`), không còn tham số nào trên URL (review A2-3, EF1, RU6).
 */
describe('QuickCreateMenu', () => {
  it('đang ở trang khác: bốn mục là link tới path TRẦN của vùng, không tham số nào', async () => {
    const user = userEvent.setup();
    renderMenu({ open: true });

    await user.click(screen.getByRole('button', { name: t.quickCreate }));

    const expected = [
      [newTour.action, '/tours'],
      [messages.admin.posts.create.action, '/posts'],
      [messages.admin.categories.create.action, '/categories'],
      [messages.admin.destinations.create.action, '/destinations'],
    ] as const;
    for (const [name, href] of expected) {
      expect(await screen.findByRole('menuitem', { name })).toHaveAttribute('href', href);
    }
  });

  it('khác trang: bấm mục thì Link đưa sang path trần, trang đích mount thì hộp tạo mở', async () => {
    const user = userEvent.setup();
    const { unmount } = renderMenu({ open: true });

    await user.click(screen.getByRole('button', { name: t.quickCreate }));
    await user.click(await screen.findByRole('menuitem', { name: newTour.action }));
    expect(navigate).toHaveBeenCalledWith('/tours');

    // Trang đích dựng mới — trang cũ (cả shell của nó) rời đi.
    unmount();
    render(<NewTourDialog options={OPTIONS} create={vi.fn()} />);
    expect(await screen.findByRole('dialog', { name: newTour.dialog.title })).toBeInTheDocument();
  });

  it('cùng trang: mục của trang đang mở không điều hướng — hộp mở ngay, query lọc và lịch sử giữ nguyên', async () => {
    location.pathname = '/tours';
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <QuickCreateMenu />
          <NewTourDialog options={OPTIONS} create={vi.fn()} />
        </SidebarProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: t.quickCreate }));
    const item = await screen.findByRole('menuitem', { name: newTour.action });
    expect(item).not.toHaveAttribute('href');
    // Ba mục kia vẫn là link sang trang của chúng.
    expect(
      screen.getByRole('menuitem', { name: messages.admin.posts.create.action }),
    ).toHaveAttribute('href', '/posts');

    await user.click(item);

    expect(await screen.findByRole('dialog', { name: newTour.dialog.title })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('thu gọn thành cột icon: rê vào nút thì tooltip nói tên nút', async () => {
    const user = userEvent.setup();
    renderMenu({ open: false });
    expect(visibleText(t.quickCreate)).toHaveLength(1);

    await user.hover(screen.getByRole('button', { name: t.quickCreate }));

    // Một ở nhãn (bị cột icon cắt mất), một ở tooltip.
    await waitFor(() => expect(visibleText(t.quickCreate)).toHaveLength(2));
  });

  it('menu mở bên dưới khi sidebar mở rộng, bên phải khi thu về cột icon', async () => {
    const user = userEvent.setup();
    const { unmount } = renderMenu({ open: true });
    await user.click(screen.getByRole('button', { name: t.quickCreate }));
    expect(await screen.findByRole('menu')).toHaveAttribute('data-side', 'bottom');
    unmount();

    renderMenu({ open: false });
    await user.click(screen.getByRole('button', { name: t.quickCreate }));
    expect(await screen.findByRole('menu')).toHaveAttribute('data-side', 'right');
  });
});
