import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { deriveReadMinutes, toJournalPost } from './posts';

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
