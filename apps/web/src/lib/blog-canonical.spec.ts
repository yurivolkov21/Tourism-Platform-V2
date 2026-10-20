import { describe, expect, it, vi } from 'vitest';
import { generateMetadata } from '@/app/(site)/blog/[slug]/page';
import { metadata } from '@/app/(site)/blog/page';
import type { JournalPostDetail } from './api/posts';

// `generateMetadata` của bài đọc API qua `fetchPostDetail` — giả lập đúng hàm đó.
vi.mock('./api/posts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/posts')>()),
  fetchPostDetail: vi.fn(
    async (slug: string): Promise<JournalPostDetail | null> =>
      slug === 'eating-your-way-through-hoi-an'
        ? {
            slug,
            title: 'Eating your way through Hoi An',
            excerpt: 'Cao lầu, bánh mì and the market at dawn.',
            cover: null,
            date: '2026-07-08',
            readMinutes: 6,
            category: 'Food',
            author: 'Guide',
            tags: [],
            contentMarkdown: '## Morning',
            relatedTours: [],
          }
        : null,
  ),
}));

/**
 * Canonical của cụm blog — thụt lùi so với Nexora đã ghi từ 27/07
 * (`docs/analysis/nexora-parity/2026-07-27-tours-parity-nexora.md`, "mẫu blog bỏ
 * sót"): `/tours`, `/tours/[slug]`, `/destinations`, trang vùng đều có, riêng blog
 * thì không. Thiếu nó thì mọi biến thể `?topic=`/`?place=`/`?q=`/`?page=` của /blog
 * là một URL "trùng nội dung" riêng với crawler.
 */
describe('canonical của /blog và /blog/[slug]', () => {
  it('/blog trỏ về chính nó, bỏ mọi query lọc và phân trang', () => {
    expect(metadata.alternates?.canonical).toBe('/blog');
  });

  it('/blog/[slug] trỏ về đúng slug của bài', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'eating-your-way-through-hoi-an' }),
    });
    expect(meta.alternates?.canonical).toBe('/blog/eating-your-way-through-hoi-an');
  });
});
