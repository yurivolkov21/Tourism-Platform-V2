import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { PostsQuery } from '@/lib/posts-query';
import type { PostRowVM } from '@/lib/posts-view';
import { requestCreate } from '@/lib/quick-create';
import { PostsTable } from './posts-table';

/**
 * Bảng `/posts` (spec P4e-4 §4.2) — soi phần RIÊNG của vùng, không soi lại kit: tiêu đề
 * là link sang trang sửa, chip nói đúng trạng thái hiển thị, ô ảnh trống vẫn có chữ.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const t = messages.admin.posts.list;

const row = (patch: Partial<PostRowVM> = {}): PostRowVM => ({
  id: '7a1b2c3d-0000-4000-8000-0000000000b1',
  slug: 'eating-your-way-through-hoi-an',
  title: 'Eating your way through Hội An',
  editorHref: '/posts/eating-your-way-through-hoi-an',
  displayStatus: 'scheduled',
  statusLabel: messages.admin.posts.status.scheduled,
  published: '5 Oct 2026, 09:30 UTC',
  tags: 'Art, Zen',
  updated: '2 Oct 2026, 10:11 UTC',
  thumbUrl: null,
  ...patch,
});

const QUERY: PostsQuery = { page: 1, limit: 20 };

function renderTable(rows: PostRowVM[]) {
  return render(
    <PostsTable rows={rows} query={QUERY} total={rows.length} totalPages={1} create={vi.fn()} />,
  );
}

describe('PostsTable', () => {
  it('tiêu đề là link sang trang sửa; slug in ngay dưới', () => {
    renderTable([row()]);
    expect(screen.getByRole('link', { name: 'Eating your way through Hội An' })).toHaveAttribute(
      'href',
      '/posts/eating-your-way-through-hoi-an',
    );
    expect(screen.getByText('eating-your-way-through-hoi-an')).toBeInTheDocument();
  });

  it('chip trạng thái, ngày đăng, tag và lần sửa cuối in đúng chữ của VM', () => {
    renderTable([row()]);
    // Soi trong bảng: "Scheduled" cũng là nhãn của một tab lọc.
    const table = screen.getByRole('table');
    expect(within(table).getByText(messages.admin.posts.status.scheduled)).toBeInTheDocument();
    expect(screen.getByText('5 Oct 2026, 09:30 UTC')).toBeInTheDocument();
    expect(screen.getByText('Art, Zen')).toBeInTheDocument();
    expect(screen.getByText('2 Oct 2026, 10:11 UTC')).toBeInTheDocument();
  });

  // Hành vi chi tiết của ô ảnh nằm ở spec kit `TableThumb` (review RU5); ở đây chỉ canh bảng
  // dùng kit ấy với URL của VM và chữ ô trống của vùng Posts.
  it('ô ảnh bìa là kit TableThumb: đúng URL của VM, ảnh hỏng thành "Photo unavailable", chưa có ảnh thì ô mang chữ của vùng', () => {
    const thumbUrl =
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_160/v1/tourism/posts/x/cover';
    const { container } = renderTable([
      row({ thumbUrl }),
      row({ id: 'b2', slug: 'b', title: 'B', editorHref: '/posts/b' }),
    ]);

    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('src', thumbUrl);
    expect(screen.getByText(t.noImage)).toHaveClass('sr-only');

    fireEvent.error(img);
    expect(
      screen.getByRole('img', { name: messages.admin.table.photoUnavailable }),
    ).toBeInTheDocument();
  });

  it('thanh công cụ có nút New post', () => {
    renderTable([row()]);
    expect(
      screen.getByRole('button', { name: messages.admin.posts.create.action }),
    ).toBeInTheDocument();
  });

  it('Quick Create (yêu cầu tạo bài) tới được hộp New post', async () => {
    renderTable([row()]);
    act(() => requestCreate('post'));
    expect(
      await screen.findByRole('dialog', { name: messages.admin.posts.create.dialog.title }),
    ).toBeInTheDocument();
  });

  it('danh sách rỗng nói đúng câu của vùng', () => {
    renderTable([]);
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});
