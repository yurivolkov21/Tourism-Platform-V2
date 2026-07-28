import type { MetadataRoute } from 'next';
import { sitemapEntries } from '@/lib/sitemap';
import { JOURNAL_POSTS } from '@/mocks/journal';
import { TOURS } from '@/mocks/tours';

// Vỏ mỏng: toàn bộ quyết định (trang nào vào, priority bao nhiêu, lastModified
// lấy từ đâu) nằm trong `lib/sitemap.ts` và có 12 test canh — project Vitest
// `node` không quét `app/**` nên logic để trong route file là logic không ai kiểm.
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(TOURS, JOURNAL_POSTS);
}
