import { describe, expect, it } from 'vitest';
import type { MockJournalPost } from '@/mocks/types';
import {
  adjacentPosts,
  filterPostsByCategory,
  postCategories,
  relatedPosts,
  sortPostsByDate,
} from './blog.js';

// Không dùng `as const`: nó biến `sections: []` thành readonly tuple, lệch
// kiểu với MockJournalPost.sections (mảng mutable) — vỡ dưới strict mode.
const post = (slug: string, date: string, category: string): MockJournalPost => ({
  slug,
  title: slug,
  excerpt: '',
  date,
  readMinutes: 5,
  image: '/mock/halong.jpg',
  category,
  author: 'Guide',
  sections: [],
});

const POSTS = [
  post('a', '2026-01-10', 'Food'),
  post('b', '2026-03-01', 'Nature'),
  post('c', '2026-02-05', 'Food'),
];

describe('sortPostsByDate', () => {
  it('mới nhất lên đầu', () => {
    expect(sortPostsByDate(POSTS).map((p) => p.slug)).toEqual(['b', 'c', 'a']);
  });

  it('không sửa mảng gốc', () => {
    sortPostsByDate(POSTS);
    expect(POSTS.map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('filterPostsByCategory', () => {
  it('không truyền chuyên mục thì trả nguyên danh sách', () => {
    expect(filterPostsByCategory(POSTS)).toHaveLength(3);
  });

  it('lọc đúng chuyên mục', () => {
    expect(filterPostsByCategory(POSTS, 'Food').map((p) => p.slug)).toEqual(['a', 'c']);
  });

  it('chuyên mục lạ trả mảng rỗng, không ném lỗi', () => {
    expect(filterPostsByCategory(POSTS, 'Submarine')).toEqual([]);
  });
});

describe('postCategories', () => {
  it('trả chuyên mục duy nhất theo thứ tự xuất hiện', () => {
    expect(postCategories(POSTS)).toEqual(['Food', 'Nature']);
  });
});

describe('adjacentPosts', () => {
  it('bài giữa có cả bài mới hơn lẫn cũ hơn', () => {
    const { newer, older } = adjacentPosts(POSTS, 'c');
    expect(newer?.slug).toBe('b');
    expect(older?.slug).toBe('a');
  });

  it('bài mới nhất không có bài mới hơn', () => {
    expect(adjacentPosts(POSTS, 'b').newer).toBeUndefined();
  });

  it('bài cũ nhất không có bài cũ hơn', () => {
    expect(adjacentPosts(POSTS, 'a').older).toBeUndefined();
  });

  it('slug lạ trả hai đầu rỗng', () => {
    expect(adjacentPosts(POSTS, 'zzz')).toEqual({ newer: undefined, older: undefined });
  });
});

describe('relatedPosts', () => {
  it('ưu tiên bài cùng chuyên mục và không bao giờ chứa chính nó', () => {
    const result = relatedPosts(POSTS, 'a', 2);
    expect(result.map((p) => p.slug)).not.toContain('a');
    expect(result[0]?.slug).toBe('c');
  });

  it('thiếu bài cùng chuyên mục thì bù bằng bài mới nhất', () => {
    const result = relatedPosts(POSTS, 'b', 2);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.slug)).not.toContain('b');
  });

  it('không trả quá limit', () => {
    expect(relatedPosts(POSTS, 'a', 1)).toHaveLength(1);
  });
});
