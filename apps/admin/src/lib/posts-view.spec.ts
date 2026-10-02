import type { AdminPostRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { postEditorHref, toPostRowVM } from './posts-view';

const ROW: AdminPostRow = {
  id: '7a1b2c3d-0000-4000-8000-0000000000b1',
  slug: 'eating-your-way-through-hoi-an',
  title: 'Eating your way through Hội An',
  status: 'PUBLISHED',
  publishedAt: '2026-10-05T09:30:00.000Z',
  displayStatus: 'scheduled',
  coverUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/posts/x/cover',
  tags: [
    { slug: 'art', name: 'Art' },
    { slug: 'zen', name: 'Zen' },
  ],
  updatedAt: '2026-10-02T10:11:12.345Z',
};

describe('toPostRowVM', () => {
  it('bài hẹn giờ: chip Scheduled, ngày đăng theo UTC, tag nối dấu phẩy, ảnh 160px', () => {
    expect(toPostRowVM(ROW)).toEqual({
      id: ROW.id,
      slug: ROW.slug,
      title: ROW.title,
      editorHref: '/posts/eating-your-way-through-hoi-an',
      displayStatus: 'scheduled',
      statusLabel: 'Scheduled',
      published: '5 Oct 2026, 09:30 UTC',
      tags: 'Art, Zen',
      updated: '2 Oct 2026, 10:11 UTC',
      thumbUrl:
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_160/v1/tourism/posts/x/cover',
    });
  });

  it('nháp còn giữ ngày đăng cũ trong DB: KHÔNG in ngày ấy; không tag, không ảnh', () => {
    const vm = toPostRowVM({
      ...ROW,
      status: 'DRAFT',
      displayStatus: 'draft',
      tags: [],
      coverUrl: null,
    });
    expect(vm.statusLabel).toBe(messages.admin.posts.status.draft);
    expect(vm.published).toBe('—');
    expect(vm.tags).toBe('—');
    expect(vm.thumbUrl).toBeNull();
  });
});

describe('postEditorHref', () => {
  it('trang sửa nằm dưới /posts', () => {
    expect(postEditorHref('a-b')).toBe('/posts/a-b');
  });
});
