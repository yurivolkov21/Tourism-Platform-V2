import type { MetadataRoute } from 'next';
import { fetchPosts } from '@/lib/api/posts';
import { settle } from '@/lib/api/resilience';
import { fetchTours } from '@/lib/api/tours';
import { sitemapEntries } from '@/lib/sitemap';
import { REGIONS } from '@/mocks/regions';

// Vỏ mỏng: toàn bộ quyết định (trang nào vào, priority bao nhiêu, lastModified
// lấy từ đâu) nằm trong `lib/sitemap.ts` và có test canh — project Vitest
// `node` không quét `app/**` nên logic để trong route file là logic không ai kiểm.
//
// `REGIONS` truyền vào đây phải là ĐÚNG nguồn mà
// `destinations/[region]/page.tsx` dùng cho `generateStaticParams` — cả hai đọc
// `@/mocks/regions`, nên sitemap không thể liệt kê URL chưa được prerender.
// REGIONS vẫn mock (chưa đổi nguồn) — lệch tạm CHỦ ĐÍCH, xem báo cáo Task 10 §4.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fail → mảng rỗng (sitemap thiếu tour/blog TẠM còn hơn build đổ vỡ), không
  // phải ném lỗi: ISR 300s của `sitemapEntries`/route này tự chữa ở lần build
  // sau khi API sống lại. Cùng lý lẽ với posts (Task 9).
  const [toursRes, postsRes] = await Promise.all([settle(fetchTours()), settle(fetchPosts())]);
  return sitemapEntries(toursRes.data ?? [], postsRes.data ?? [], REGIONS);
}
