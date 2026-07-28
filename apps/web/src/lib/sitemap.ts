import type { MockJournalPost, MockTourCard } from '@/mocks/types';
import { absoluteUrl } from './site';

/** Một mục sitemap. Hình dạng gương `MetadataRoute.Sitemap` của Next để
    `app/sitemap.ts` chỉ là lớp vỏ mỏng, còn logic thì test được ở môi trường
    `node` (project `dom` không quét `app/**`). */
export interface SitemapEntry {
  url: string;
  /** YYYY-MM-DD. `undefined` khi KHÔNG có ngày thật để nói — xem comment dưới. */
  lastModified?: string;
  priority: number;
}

/**
 * Trang tĩnh có thật, kèm priority. Thang theo plan: trang chủ 1.0 · listing tour
 * 0.9 · tour detail 0.8 · còn lại 0.6–0.7.
 *
 * KHÔNG có trang auth: `/login`, `/register`, `/forgot-password`,
 * `/reset-password`, `/verify-email`, `/two-factor` — không trang nào có giá trị
 * index, và liệt kê chúng chỉ vẽ thêm bề mặt cho crawler dò.
 *
 * `/destinations` và `/tours/[slug]/book` CHƯA tồn tại nên cũng không có ở đây;
 * sitemap trỏ vào 404 là cách nhanh nhất để crawler hạ tin cậy cả file.
 */
const STATIC_PAGES: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/tours', priority: 0.9 },
  { path: '/blog', priority: 0.7 },
  { path: '/about', priority: 0.7 },
  { path: '/contact', priority: 0.7 },
  { path: '/faq', priority: 0.7 },
  { path: '/cancellation-policy', priority: 0.6 },
  { path: '/terms', priority: 0.6 },
  { path: '/privacy', priority: 0.6 },
];

/**
 * Dựng toàn bộ mục sitemap. Thuần, tất định, không đọc đồng hồ.
 *
 * `lastModified` CHỈ điền khi có ngày thật trong dữ liệu: bài blog có
 * `updated ?? date`, còn tour thì contract không trả ngày nào nên bỏ trống. Hai
 * lý do không bịa bằng `new Date()`: nó nói với crawler một điều không đúng, và
 * nó làm output build phụ thuộc thời điểm chạy — cùng một commit sinh ra hai
 * sitemap khác nhau. Khi contract mở `updatedAt` cho tour thì sửa test trước.
 */
export function sitemapEntries(
  tours: readonly MockTourCard[],
  posts: readonly MockJournalPost[],
): SitemapEntry[] {
  return [
    ...STATIC_PAGES.map(({ path, priority }) => ({ url: absoluteUrl(path), priority })),
    ...tours.map((tour) => ({ url: absoluteUrl(`/tours/${tour.slug}`), priority: 0.8 })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.updated ?? post.date,
      priority: 0.6,
    })),
  ];
}
