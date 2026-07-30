import type { MetadataRoute } from 'next';
import { sitemapEntries } from '@/lib/sitemap';
import { JOURNAL_POSTS } from '@/mocks/journal';
import { REGIONS } from '@/mocks/regions';
import { TOURS } from '@/mocks/tours';

// Vỏ mỏng: toàn bộ quyết định (trang nào vào, priority bao nhiêu, lastModified
// lấy từ đâu) nằm trong `lib/sitemap.ts` và có test canh — project Vitest
// `node` không quét `app/**` nên logic để trong route file là logic không ai kiểm.
//
// `REGIONS` truyền vào đây phải là ĐÚNG nguồn mà
// `destinations/[region]/page.tsx` dùng cho `generateStaticParams` — cả hai đọc
// `@/mocks/regions`, nên sitemap không thể liệt kê URL chưa được prerender.
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(TOURS, JOURNAL_POSTS, REGIONS);
}
