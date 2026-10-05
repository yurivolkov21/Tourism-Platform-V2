import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { PostBanner } from './post-banner';

/**
 * Dải báo của trang sửa bài (vòng review P4e-4 — trước đó chỉ được chạm gián tiếp qua spec của
 * cả trang, nên "luôn hiện Reload" lọt qua mà không test nào đỏ). Reload chỉ có ở chỗ không rõ
 * thế giới đang ra sao: bản người khác vừa lưu, hay lệnh không rõ đã đi tới đâu.
 */
const t = messages.admin.posts.editor;

describe('PostBanner', () => {
  it('stale: nói người khác vừa lưu, kèm Reload', async () => {
    const onReload = vi.fn();
    const user = userEvent.setup();
    render(<PostBanner banner={{ kind: 'stale' }} onReload={onReload} />);

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(t.banners.stale)).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: t.banners.reload }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('lỗi ĐÃ rõ kết cục: chỉ câu báo, KHÔNG có Reload — Reload không đổi được gì', () => {
    render(
      <PostBanner
        banner={{ kind: 'error', message: 'Slow down.', uncertain: false }}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Slow down.');
    expect(screen.queryByRole('button', { name: t.banners.reload })).not.toBeInTheDocument();
  });

  it('lỗi KHÔNG rõ kết cục: câu báo kèm Reload', () => {
    render(
      <PostBanner
        banner={{ kind: 'error', message: 'It may have gone through.', uncertain: true }}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: t.banners.reload })).toBeInTheDocument();
  });

  it('notReady: mỗi mục thiếu là một link tới đúng ô, theo thứ tự form bày', () => {
    render(
      <PostBanner
        banner={{ kind: 'notReady', missing: ['content', 'cover'] }}
        onReload={vi.fn()}
      />,
    );

    const links = within(screen.getByRole('alert')).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      [t.publish.readiness.content, '#post-content'],
      [t.publish.readiness.cover, '#post-cover'],
    ]);
    expect(screen.queryByRole('button', { name: t.banners.reload })).not.toBeInTheDocument();
  });
});
