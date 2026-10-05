import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { SidebarProvider } from '@tourism/ui/components/sidebar';
import { TooltipProvider } from '@tourism/ui/components/tooltip';
import { describe, expect, it } from 'vitest';
import { QuickCreateMenu } from './quick-create-menu';

const t = messages.admin.shell;

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

/** Quick Create (spec 2026-10-05 §2.5): bốn mục, mỗi mục mở trang vùng với hộp tạo bật sẵn. */
describe('QuickCreateMenu', () => {
  it('mở ra bốn mục, mỗi mục trỏ `?create=1` của đúng trang', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <QuickCreateMenu />
        </SidebarProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: messages.admin.shell.quickCreate }));

    const expected = [
      [messages.admin.tours.editor.create.action, '/tours?create=1'],
      [messages.admin.posts.create.action, '/posts?create=1'],
      [messages.admin.categories.create.action, '/categories?create=1'],
      [messages.admin.destinations.create.action, '/destinations?create=1'],
    ] as const;
    for (const [name, href] of expected) {
      expect(await screen.findByRole('menuitem', { name })).toHaveAttribute('href', href);
    }
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
