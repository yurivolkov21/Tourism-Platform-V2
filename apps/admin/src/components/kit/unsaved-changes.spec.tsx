import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { SidebarProvider } from '@tourism/ui/components/sidebar';
import { TooltipProvider } from '@tourism/ui/components/tooltip';
import Link from 'next/link';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickCreateMenu } from '@/components/quick-create-menu';
import { UnsavedChangesProvider, useReportUnsaved } from './unsaved-changes';

const { push, navigate } = vi.hoisted(() => ({ push: vi.fn(), navigate: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => '/tours/ha-long',
}));
vi.mock('next/link', async () => (await import('@/test/next-link')).nextLinkMock(navigate));

function Form({ dirty }: { dirty: boolean }) {
  useReportUnsaved(dirty);
  return <p>form</p>;
}

function Page({ dirty, showForm = true }: { dirty: boolean; showForm?: boolean }) {
  return (
    <UnsavedChangesProvider>
      <a href="/tours/ha-long/itinerary">Itinerary</a>
      {showForm ? <Form dirty={dirty} /> : null}
    </UnsavedChangesProvider>
  );
}

beforeEach(() => {
  push.mockReset();
  navigate.mockReset();
});

describe('UnsavedChangesProvider', () => {
  it('có thay đổi mà bấm link nội bộ → hỏi, chưa đi đâu cả', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(
      screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('`next/link` KHÔNG điều hướng khi đang hỏi — nó thấy `defaultPrevented`', async () => {
    // `next/link` điều hướng bằng router trong `onClick` của React, không qua hành vi mặc định
    // của thẻ <a>, và nó bỏ cú bấm đã bị `preventDefault` ở pha CAPTURE của `document`. Bản giả
    // (`@/test/next-link`) giữ đúng hợp đồng ấy — `onClick` VẪN chạy, chỉ điều hướng thì không
    // (review AL5: chặn bằng `stopPropagation` nuốt luôn `onClick` của mục menu).
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <Link href="/tours/ha-long/costs">Costs</Link>
        <Form dirty />
      </UnsavedChangesProvider>,
    );

    await user.click(screen.getByRole('link', { name: 'Costs' }));

    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument();
  });

  it('Discard changes → đi đúng đường vừa bấm', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(push).toHaveBeenCalledWith('/tours/ha-long/itinerary');
  });

  it('Keep editing → đóng hộp, ở lại', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('không có thay đổi → không hỏi', async () => {
    const user = userEvent.setup();
    render(<Page dirty={false} />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('form gỡ khỏi trang thì thôi báo thay đổi', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Page dirty />);
    rerender(<Page dirty showForm={false} />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('bấm mục Quick Create sang trang khác: hộp hỏi mở, menu ĐÓNG, chưa đi đâu (review AL5)', async () => {
    // Hộp hỏi chặn điều hướng nhưng không được nuốt `onClick` của mục menu — chính nó đóng menu.
    // Menu nuốt mất thì vẫn mở, nổi trên hộp hỏi và vẫn bấm được.
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <UnsavedChangesProvider>
            <QuickCreateMenu />
            <Form dirty />
          </UnsavedChangesProvider>
        </SidebarProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: messages.admin.shell.quickCreate }));
    await user.click(
      await screen.findByRole('menuitem', { name: messages.admin.tours.editor.create.action }),
    );

    expect(
      await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument();
    // `hidden: true`: hộp hỏi gắn `aria-hidden` cho mọi thứ ngoài nó, menu còn mở cũng bị giấu.
    await waitFor(() => expect(screen.queryByRole('menu', { hidden: true })).toBeNull());
    expect(navigate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('có thay đổi thì beforeunload bị chặn; không có thì không', () => {
    const { rerender } = render(<Page dirty />);
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    rerender(<Page dirty={false} />);
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});
