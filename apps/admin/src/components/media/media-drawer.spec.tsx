import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toMediaItemVM } from '@/lib/media-view';
import type { UpdateMediaAction } from '@/lib/media-write';
import { LIBRARY_ID, mediaItem, USAGES } from '@/test/media';
import { MediaDrawer } from './media-drawer';

/**
 * Ngăn chi tiết (spec P4f Media §6.2): số đo, tên file bấm để chép, mỗi chỗ dùng một dòng có link
 * tới trình sửa, form ở cuối.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const d = messages.admin.media.drawer;

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
});

function renderDrawer(
  item = mediaItem({ usages: [USAGES.library, USAGES.tourA, USAGES.post, USAGES.slot] }),
) {
  const onClose = vi.fn();
  render(
    <MediaDrawer
      item={toMediaItemVM(item)}
      licenses={[]}
      update={vi.fn<UpdateMediaAction>()}
      onClose={onClose}
    />,
  );
  return { onClose };
}

describe('MediaDrawer', () => {
  it('số đo, dung lượng, format, nguồn, tên file', async () => {
    renderDrawer();
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('2400 × 1600 px')).toBeInTheDocument();
    expect(within(drawer).getByText('512 KB')).toBeInTheDocument();
    expect(within(drawer).getByText('JPG')).toBeInTheDocument();
    expect(within(drawer).getByText(d.source.CATALOG)).toBeInTheDocument();
    expect(within(drawer).getByText(LIBRARY_ID)).toBeInTheDocument();
  });

  it('mỗi chỗ dùng một link tới trình sửa của nó', async () => {
    renderDrawer();
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText(d.usedInCount(4))).toBeInTheDocument();
    const links = within(drawer)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')]);
    expect(links).toEqual([
      ['Hoi An', '/destinations/hoi-an/photos'],
      ['Hoi An by night', '/tours/hoi-an-by-night/photos'],
      ['A night market', '/posts/a-night-market'],
      ['Home · Hero', '/appearance#home-hero'],
    ]);
    expect(
      within(drawer).getByRole('link', { name: d.edit('Tour · Hoi An by night') }),
    ).toBeInTheDocument();
  });

  it('chép tên file vào clipboard rồi báo', async () => {
    const user = userEvent.setup();
    renderDrawer();
    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('button', { name: d.copy }));
    await waitFor(() => expect(success).toHaveBeenCalledWith(d.copied));
    await expect(navigator.clipboard.readText()).resolves.toBe(LIBRARY_ID);
  });

  it('nút đóng gọi onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('button', { name: d.close }));
    expect(onClose).toHaveBeenCalled();
  });
});
