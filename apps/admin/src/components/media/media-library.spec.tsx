import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateMediaAction } from '@/lib/media-write';
import { mediaItem, mediaQueue, queueRow, USAGES } from '@/test/media';
import { MediaLibrary } from './media-library';

/**
 * Trang `/media` (spec P4f Media §6): ba thẻ số, hai tab đọc từ URL, lọc ngay trên trình duyệt và
 * đổi URL bằng `history.pushState` (không kéo lại server), bấm một ô mở ngăn chi tiết.
 */
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => search,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const t = messages.admin.media;

const ITEMS = [
  mediaItem(),
  mediaItem({
    publicId: 'tourism/posts/0cccc001-0000-4000-8000-000000000001/stalls',
    alt: 'Stalls at dusk',
    altRequired: false,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
    source: 'UPLOAD',
    usages: [USAGES.post],
  }),
  mediaItem({
    publicId: 'tourism/catalog/site/home-hero',
    alt: 'Ha Long at sunrise',
    altRequired: false,
    licenseUrl: null,
    attention: ['CREDIT_INCOMPLETE'],
    usages: [USAGES.slot],
  }),
];

const pushState = vi.spyOn(window.history, 'pushState');

beforeEach(() => {
  search = new URLSearchParams();
  pushState.mockReset();
});

function renderPage() {
  return render(
    <MediaLibrary
      items={ITEMS}
      queue={mediaQueue({
        rows: [queueRow(), queueRow({ publicId: 'x/y', state: 'IN_USE', dueAt: null })],
      })}
      update={vi.fn<UpdateMediaAction>()}
    />,
  );
}

describe('MediaLibrary', () => {
  it('ba thẻ số: ảnh đang dùng, cần chú ý, đang chờ xoá', () => {
    renderPage();
    const stats = screen.getByRole('region', { name: messages.admin.stats.regionLabel });
    expect(within(stats).getByText(t.stats.photos).closest('[data-slot="card"]')).toHaveTextContent(
      '3',
    );
    expect(
      within(stats).getByText(t.stats.attention).closest('[data-slot="card"]'),
    ).toHaveTextContent('1');
    expect(
      within(stats).getByText(t.stats.waiting).closest('[data-slot="card"]'),
    ).toHaveTextContent('1');
  });

  it('mặc định là tab In use: mỗi ảnh một ô, nhãn Uploaded, chấm cần chú ý', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: t.tabs.inUse })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(t.count(3, 3))).toBeInTheDocument();
    const grid = screen.getByRole('button', { name: /Stalls at dusk/ });
    expect(within(grid).getByText(t.uploaded)).toBeInTheDocument();
    expect(screen.getAllByTestId('media-attention')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /Lanterns over the river.*Library · 2 tours/ }),
    ).toBeInTheDocument();
  });

  it('bộ lọc đọc từ URL, lọc ngay trên trình duyệt', () => {
    search = new URLSearchParams('used=posts');
    renderPage();
    expect(screen.getByText(t.count(1, 3))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stalls at dusk/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lanterns/ })).not.toBeInTheDocument();
  });

  it('tìm: đổi URL bằng pushState, không điều hướng qua router', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(t.filters.searchLabel), 'lantern{Enter}');
    expect(pushState).toHaveBeenCalledWith(null, '', '/media?q=lantern');
  });

  it('không ảnh nào khớp: câu rỗng và nút xoá bộ lọc', async () => {
    const user = userEvent.setup();
    search = new URLSearchParams('used=site&show=nocredit');
    renderPage();
    expect(screen.getByText(t.empty)).toBeInTheDocument();
    const clear = screen.getAllByRole('button', { name: messages.admin.table.clearFilters });
    await user.click(clear[clear.length - 1] as HTMLElement);
    expect(pushState).toHaveBeenLastCalledWith(null, '', '/media');
  });

  it('đổi tab đẩy ?tab=queue; URL ấy mở bảng hàng dọn', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();
    await user.click(screen.getByRole('tab', { name: t.tabs.queue }));
    expect(pushState).toHaveBeenCalledWith(null, '', '/media?tab=queue');
    unmount();

    search = new URLSearchParams('tab=queue');
    renderPage();
    expect(screen.getByRole('tab', { name: t.tabs.queue })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('table', { name: t.queue.caption })).toBeInTheDocument();
  });

  it('bấm một ô mở ngăn chi tiết của đúng ảnh', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Lanterns over the river/ }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText(t.drawer.title)).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: /Central coast/ })).toHaveAttribute(
      'href',
      '/tours/central-coast/photos',
    );
  });
});
