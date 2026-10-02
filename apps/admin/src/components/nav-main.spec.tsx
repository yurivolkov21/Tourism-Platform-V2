import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarProvider } from '@tourism/ui/components/sidebar';
import { TooltipProvider } from '@tourism/ui/components/tooltip';
import { describe, expect, it, vi } from 'vitest';
import { NavMain } from './nav-main';

/**
 * Nav chính khi sidebar thu gọn thành cột icon (góp ý giao diện 28/09, demo đã
 * duyệt): mỗi icon có tooltip tên trang; mục chưa mở vẫn nói được vì sao không bấm
 * được; trang đang mở có ô sáng; ba nhóm cách nhau bằng vạch mảnh.
 */
vi.mock('next/navigation', () => ({ usePathname: () => '/tours/ha-long-bay-cruise' }));

function renderNav({ open }: { open: boolean }) {
  return render(
    <TooltipProvider>
      <SidebarProvider defaultOpen={open}>
        <NavMain />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

describe('NavMain', () => {
  it('thu gọn: rê chuột vào icon thì tooltip nói tên trang', async () => {
    const user = userEvent.setup();
    renderNav({ open: false });

    expect(screen.getAllByText('Bookings')).toHaveLength(1);

    await user.hover(screen.getByRole('link', { name: 'Bookings' }));

    // Một ở nhãn (ẩn trong cột icon), một ở tooltip.
    await waitFor(() => expect(screen.getAllByText('Bookings')).toHaveLength(2));
  });

  it('mở rộng: không có tooltip — nhãn đã nằm ngay cạnh icon', async () => {
    const user = userEvent.setup();
    renderNav({ open: true });

    await user.hover(screen.getByRole('link', { name: 'Bookings' }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    // Popup có thể có mặt trong DOM nhưng mang `hidden` — chỉ đếm chữ đang hiện.
    const shown = screen
      .getAllByText('Bookings')
      .filter((node) => node.closest('[hidden]') === null);
    expect(shown).toHaveLength(1);
  });

  it('mục chưa mở tiêu điểm được (aria-disabled, không disabled), tooltip nói "Soon"', async () => {
    const user = userEvent.setup();
    renderNav({ open: false });
    const media = screen.getByRole('button', { name: 'Media library' });

    expect(media).toHaveAttribute('aria-disabled', 'true');
    expect(media).not.toBeDisabled();
    await user.hover(media);
    expect(await screen.findByText('Media library · Soon')).toBeInTheDocument();
  });

  it('trang đang mở (kể cả trang con) sáng và mang aria-current', () => {
    renderNav({ open: true });

    expect(screen.getByRole('link', { name: 'Tours' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Tours' })).toHaveAttribute('data-active');
    expect(screen.getByRole('link', { name: 'Bookings' })).not.toHaveAttribute('aria-current');
  });

  it('thu gọn: nút Inbox ẩn hẳn (không chỉ trong suốt mà vẫn nhận Tab); nhóm thứ hai trở đi có vạch ngăn', () => {
    renderNav({ open: false });

    expect(screen.getByRole('button', { name: 'Inbox', hidden: true })).toHaveClass(
      'group-data-[collapsible=icon]:hidden',
    );
    const groups = [...document.querySelectorAll('[data-slot="sidebar-group"]')];
    // Khối Quick Create, rồi Operations, Content, System.
    expect(groups).toHaveLength(4);
    const divided = groups.map((group) =>
      group.classList.contains('group-data-[collapsible=icon]:border-t'),
    );
    expect(divided).toEqual([false, false, true, true]);
  });
});
