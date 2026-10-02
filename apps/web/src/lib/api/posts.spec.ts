import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deriveReadMinutes,
  fetchPostDetail,
  fetchPosts,
  toJournalPost,
  toJournalPostDetail,
} from './posts';

import type { TourCardVM } from './tours';

// Mock client oRPC — chỉ soi procedure, input và tag cache; không gọi API thật.
const { list, bySlug } = vi.hoisted(() => ({ list: vi.fn(), bySlug: vi.fn() }));
vi.mock('./client', () => ({ api: { posts: { list, bySlug } } }));

beforeEach(() => {
  list.mockReset();
  bySlug.mockReset();
});

function tour(slug: string): TourCardVM {
  return {
    id: `id-${slug}`,
    slug,
    title: slug,
    summary: null,
    basePrice: '199.00',
    priceFrom: '199.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'hoi-an', name: 'Hoi An', isPrimary: true }],
    category: { slug: 'food', name: 'Food' },
    ratingAvg: 4.5,
    ratingCount: 20,
    cover: null,
  };
}

// Fixture tay theo PostCardSchema (libs/shared/contract/src/schemas/posts.ts)
// — không gọi API thật, chỉ test phần thuần (mapper DTO → VM).
const dto = {
  id: '0198c9c4-0000-7000-8000-000000000001',
  slug: 'what-to-pack-for-the-mist-season',
  title: 'What to pack for the mist season',
  excerpt: 'A light jacket, real shoes, and patience.',
  publishedAt: '2026-07-22T08:00:00.000Z',
  cover: null,
  tags: [
    { slug: 'packing', name: 'Packing' },
    { slug: 'sa-pa', name: 'Sa Pa' },
  ],
  author: { name: 'Seed Admin', avatarUrl: null },
};

describe('toJournalPost', () => {
  it('map DTO → VM: date cắt YYYY-MM-DD, category = tag đầu, author = name', () => {
    const vm = toJournalPost(dto);
    expect(vm).toMatchObject({
      slug: dto.slug,
      date: '2026-07-22',
      category: 'Packing',
      author: 'Seed Admin',
    });
  });

  it('author.name null → fallback; không tag → category fallback "Journal"; excerpt null → chuỗi rỗng', () => {
    const vm = toJournalPost({
      ...dto,
      author: { name: null, avatarUrl: null },
      tags: [],
      excerpt: null,
    });
    expect(vm.author).toBe(messages.blog.fallbackAuthor);
    expect(vm.category).toBe(messages.blog.fallbackCategory);
    expect(vm.excerpt).toBe('');
  });

  it('giữ nguyên mảng tags của DTO cho chip lọc phụ', () => {
    const vm = toJournalPost(dto);
    expect(vm.tags).toEqual(dto.tags);
  });
});

describe('deriveReadMinutes', () => {
  it('~200 từ/phút, làm tròn lên, tối thiểu 1', () => {
    expect(deriveReadMinutes('one two three')).toBe(1);
    expect(deriveReadMinutes(Array(401).fill('word').join(' '))).toBe(3);
    expect(deriveReadMinutes('')).toBe(1);
  });
});

const DETAIL = {
  ...dto,
  content: '## Layers\n\nBody',
  metaTitle: null,
  metaDescription: null,
  media: [],
  relatedTours: [tour('b-tour'), tour('a-tour')],
};

describe('toJournalPostDetail', () => {
  it('giữ tour liên quan theo ĐÚNG thứ tự API trả (ADR-0051 §5)', () => {
    expect(toJournalPostDetail(DETAIL).relatedTours.map((t) => t.slug)).toEqual([
      'b-tour',
      'a-tour',
    ]);
  });
});

describe('fetchPostDetail (G9)', () => {
  it('mang thêm tag `tours` cạnh `post:<slug>` — sửa hay xoá tour làm tươi trang bài', async () => {
    bySlug.mockResolvedValue(DETAIL);

    await fetchPostDetail(dto.slug);

    expect(bySlug).toHaveBeenCalledWith(
      { slug: dto.slug },
      { context: { next: { revalidate: 300, tags: [`post:${dto.slug}`, 'tours'] } } },
    );
  });
});

describe('fetchPosts (khuôn G10)', () => {
  it('đi hết các trang, giữ thứ tự, bỏ bài trùng giữa hai trang', async () => {
    const card = (n: number) => ({
      ...dto,
      id: `0198c9c4-0000-7000-8000-00000000000${n}`,
      slug: `post-${n}`,
    });
    list
      .mockResolvedValueOnce({
        items: [card(1), card(2)],
        page: 1,
        limit: 50,
        total: 3,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [card(2), card(3)],
        page: 2,
        limit: 50,
        total: 3,
        totalPages: 2,
      });

    const posts = await fetchPosts();

    expect(posts.map((post) => post.slug)).toEqual(['post-1', 'post-2', 'post-3']);
    expect(list).toHaveBeenNthCalledWith(
      2,
      { page: 2, pageSize: 50, sort: 'publishedAt', order: 'desc' },
      { context: { next: { revalidate: 300, tags: ['posts'] } } },
    );
  });
});
