import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@tourism/ui/components/sidebar';
import { TooltipProvider } from '@tourism/ui/components/tooltip';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { TourEditorOptions } from '@/lib/api/tours';
import { NAV_GROUPS, navPath } from '@/lib/nav';
import { UnsavedChangesProvider, useReportUnsaved } from './kit/unsaved-changes';
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
/**
 * Bốn vùng của Quick Create mang icon KHÁC bản thật (href giữ nguyên): mục Quick Create gõ lại
 * icon thay vì đọc `NAV_GROUPS` thì ca RU4 đỏ, còn khớp bản thật thì không chứng minh được gì.
 */
vi.mock('@/lib/nav', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/nav')>();
  const { Bike, Newspaper, Pin, Tag } = await import('lucide-react');
  const swapped = new Map([
    ['tours', Bike],
    ['posts', Newspaper],
    ['categories', Tag],
    ['destinations', Pin],
  ]);
  return {
    ...actual,
    NAV_GROUPS: actual.NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item, icon: swapped.get(item.key) ?? item.icon })),
    })),
  };
});

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
 * Bấm kèm phím trên Link: bản thật (và `@/test/next-link`) để nguyên hành vi mặc định của thẻ cho
 * trình duyệt mở tab mới. jsdom không mở tab được mà sẽ thử điều hướng chính trang này ("Not
 * implemented: navigation"), nên chặn hành vi ấy ở `document` — chạy SAU mọi handler của React —
 * trong lúc test chạy: đứng thay việc tab mới mở ra còn trang đang xem không đổi.
 */
function stayOnPageForModifiedClicks() {
  const stay = (event: MouseEvent) => event.preventDefault();
  document.addEventListener('click', stay);
  onTestFinished(() => document.removeEventListener('click', stay));
}

/** Một form đang sửa dở trong khu làm việc tour — hộp hỏi rời trang canh mọi link. */
function DirtyForm() {
  useReportUnsaved(true);
  return null;
}

/**
 * Đồng hồ giả CHỈ thay `Date` (bộ hẹn giờ vẫn thật cho user-event và Base UI) tới hết ca; trả mốc
 * lúc bấm. Đứng yên tới khi ca tự đẩy, nên tuổi của yêu cầu đúng bằng khoảng ca đẩy.
 */
function startFakeClock(): number {
  const now = Date.UTC(2026, 9, 7, 9);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  onTestFinished(() => {
    vi.useRealTimers();
  });
  return now;
}

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

  it('path và icon mỗi mục là của mục nav cùng vùng — tra theo khoá, không gõ lại (review RU4)', async () => {
    const user = userEvent.setup();
    renderMenu({ open: true });
    await user.click(screen.getByRole('button', { name: t.quickCreate }));

    const navItems = new Map(
      NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.key, item]),
    );
    const areas = [
      [newTour.action, 'tours'],
      [messages.admin.posts.create.action, 'posts'],
      [messages.admin.categories.create.action, 'categories'],
      [messages.admin.destinations.create.action, 'destinations'],
    ] as const;
    for (const [name, key] of areas) {
      const nav = navItems.get(key);
      if (nav === undefined) throw new Error(`Không có mục nav ${key}`);
      const item = await screen.findByRole('menuitem', { name });
      expect(item).toHaveAttribute('href', navPath(nav.href));
      const { container } = render(<nav.icon aria-hidden="true" />);
      expect(item.querySelector('svg')?.outerHTML).toBe(container.querySelector('svg')?.outerHTML);
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

  // Bấm kèm phím trên link: trình duyệt mở trang đích ở tab/cửa sổ mới (Alt: tải về), tab này
  // đứng yên. Tab mới không thấy yêu cầu nằm trong bộ nhớ của tab này, còn ghi ở đây là treo một
  // yêu cầu tới 60 giây — ghé trang đích trong lúc ấy thì hộp tạo tự mở bất ngờ.
  it.each([
    ['Ctrl', '{Control>}', '{/Control}'],
    ['Cmd', '{Meta>}', '{/Meta}'],
    ['Shift', '{Shift>}', '{/Shift}'],
    ['Alt', '{Alt>}', '{/Alt}'],
  ])(
    '%s + bấm mục khác trang: nhường cú bấm cho trình duyệt, tab này không treo yêu cầu nào',
    async (_key, press, release) => {
      stayOnPageForModifiedClicks();
      const user = userEvent.setup();
      const { unmount } = renderMenu({ open: true });
      await user.click(screen.getByRole('button', { name: t.quickCreate }));
      const item = await screen.findByRole('menuitem', { name: newTour.action });

      await user.keyboard(press);
      await user.click(item);
      await user.keyboard(release);

      // Sau đó người dùng tự vào trang đích ở CHÍNH tab này: hộp tạo không được tự mở.
      unmount();
      render(<NewTourDialog options={OPTIONS} create={vi.fn()} />);
      expect(screen.queryByRole('dialog', { name: newTour.dialog.title })).toBeNull();
    },
  );

  it('cùng trang, Ctrl+bấm: mục không phải link nên không có tab mới nào để nhường — hộp vẫn mở', async () => {
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
    await user.keyboard('{Control>}');
    await user.click(item);
    await user.keyboard('{/Control}');

    expect(await screen.findByRole('dialog', { name: newTour.dialog.title })).toBeInTheDocument();
  });

  it('thu gọn thành cột icon: rê vào nút thì tooltip nói tên nút', async () => {
    const user = userEvent.setup();
    renderMenu({ open: false });
    expect(visibleText(t.quickCreate)).toHaveLength(1);

    await user.hover(screen.getByRole('button', { name: t.quickCreate }));

    // Một ở nhãn (bị cột icon cắt mất), một ở tooltip.
    await waitFor(() => expect(visibleText(t.quickCreate)).toHaveLength(2));
  });

  it('khác trang, form đang sửa dở chặn cú bấm: không ghi yêu cầu nào — ở lại rồi tự vào trang đích thì hộp tạo không tự mở (review G6-F1)', async () => {
    location.pathname = '/tours/ha-long';
    const user = userEvent.setup();
    const { unmount } = render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <UnsavedChangesProvider>
            <QuickCreateMenu />
            <DirtyForm />
          </UnsavedChangesProvider>
        </SidebarProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: t.quickCreate }));
    await user.click(await screen.findByRole('menuitem', { name: newTour.action }));
    await user.click(
      await screen.findByRole('button', { name: messages.admin.unsavedChanges.keep }),
    );
    expect(navigate).not.toHaveBeenCalled();

    // Ngay sau đó người dùng tự vào trang đích (sidebar): không có yêu cầu nào để tiêu thụ.
    unmount();
    render(<NewTourDialog options={OPTIONS} create={vi.fn()} />);
    expect(screen.queryByRole('dialog', { name: newTour.dialog.title })).toBeNull();
  });

  it('trang đích dựng xong sau 30 giây (API gói free ngủ dậy, Vercel khởi động lạnh): hộp tạo vẫn mở (review G6-F1)', async () => {
    const clickedAt = startFakeClock();
    const user = userEvent.setup();
    const { unmount } = renderMenu({ open: true });

    await user.click(screen.getByRole('button', { name: t.quickCreate }));
    await user.click(await screen.findByRole('menuitem', { name: newTour.action }));
    expect(navigate).toHaveBeenCalledWith('/tours');

    vi.setSystemTime(clickedAt + 30_000);
    unmount();
    render(<NewTourDialog options={OPTIONS} create={vi.fn()} />);
    expect(await screen.findByRole('dialog', { name: newTour.dialog.title })).toBeInTheDocument();
  });

  it('trang đích dựng xong sau hơn 60 giây: yêu cầu đã cũ, hộp tạo không tự mở (review G6-F1)', async () => {
    const clickedAt = startFakeClock();
    const user = userEvent.setup();
    const { unmount } = renderMenu({ open: true });

    await user.click(screen.getByRole('button', { name: t.quickCreate }));
    await user.click(await screen.findByRole('menuitem', { name: newTour.action }));
    expect(navigate).toHaveBeenCalledWith('/tours');

    vi.setSystemTime(clickedAt + 60_001);
    unmount();
    render(<NewTourDialog options={OPTIONS} create={vi.fn()} />);
    expect(screen.queryByRole('dialog', { name: newTour.dialog.title })).toBeNull();
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

/**
 * Sheet sidebar của điện thoại còn mở không — đọc thẳng DOM: hộp modal khác mở thì Sheet mang
 * `aria-hidden`, nên truy vấn theo role không thấy nó dù nó vẫn mở.
 */
const mobileSheetOpen = () =>
  document.querySelector('[data-slot="sidebar"][data-mobile="true"]')?.hasAttribute('data-open') ??
  false;

describe('QuickCreateMenu trên điện thoại (review B2)', () => {
  afterEach(() => {
    window.innerWidth = 1024;
  });

  it('Sheet sidebar đang mở, bấm mục của chính trang: Sheet đóng và hộp tạo mở', async () => {
    window.innerWidth = 375;
    location.pathname = '/tours';
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar collapsible="icon">
            <SidebarContent>
              <QuickCreateMenu />
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <SidebarTrigger />
            <NewTourDialog options={OPTIONS} create={vi.fn()} />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    const sheet = await screen.findByRole('dialog', { name: 'Sidebar' });
    expect(mobileSheetOpen()).toBe(true);

    await user.click(within(sheet).getByRole('button', { name: t.quickCreate }));
    await user.click(await screen.findByRole('menuitem', { name: newTour.action }));

    const dialog = await screen.findByRole('dialog', { name: newTour.dialog.title });
    await waitFor(() => expect(mobileSheetOpen()).toBe(false));
    // Sheet đóng trả focus về nút mở nó, nhưng không được giật focus ra khỏi hộp vừa mở.
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
  });

  it('Ctrl+bấm mục khác trang: Sheet KHÔNG đóng — trang đích mở ở tab mới, người dùng còn ở đây', async () => {
    window.innerWidth = 375;
    stayOnPageForModifiedClicks();
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar collapsible="icon">
            <SidebarContent>
              <QuickCreateMenu />
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <SidebarTrigger />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    const sheet = await screen.findByRole('dialog', { name: 'Sidebar' });
    await user.click(within(sheet).getByRole('button', { name: t.quickCreate }));
    const item = await screen.findByRole('menuitem', { name: newTour.action });
    await user.keyboard('{Control>}');
    await user.click(item);
    await user.keyboard('{/Control}');

    expect(mobileSheetOpen()).toBe(true);
  });
});
