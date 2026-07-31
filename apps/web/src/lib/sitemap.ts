import type { MockRegion, MockTourCard } from '@/mocks/types';
import type { JournalPost } from './api/posts';
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
 * Trang tĩnh có thật, kèm priority. Thang: trang chủ 1.0 · hai listing catalogue
 * (`/tours`, `/destinations`) 0.9 · trang chi tiết (tour, vùng) 0.8 · nội dung phụ
 * trợ 0.6–0.7.
 *
 * `/destinations` đi CÙNG BẬC với `/tours`, không thấp hơn: đây là hai lối vào
 * catalogue ngang hàng — một cái theo chuyến, một cái theo nơi — và cả hai đều là
 * trang đích của điều hướng chính. Hạ nó xuống 0.7 là nói với crawler rằng nó phụ.
 *
 * KHÔNG có trang auth: `/login`, `/register`, `/forgot-password`,
 * `/reset-password`, `/verify-email`, `/two-factor` — không trang nào có giá trị
 * index, và liệt kê chúng chỉ vẽ thêm bề mặt cho crawler dò.
 *
 * `/tours/[slug]/book` CHƯA tồn tại nên không có ở đây; sitemap trỏ vào 404 là
 * cách nhanh nhất để crawler hạ tin cậy cả file.
 *
 * ⚠️ Chỗ này từng ghi `/destinations` "CHƯA tồn tại" và bỏ nó ra — nhưng trang đã
 * ship 30/07 cùng ba trang vùng, nên suốt cụm Destinations sitemap **bỏ sót 4 URL
 * của trang đang sống**. Bài học: câu "chưa tồn tại" trong comment là một khẳng
 * định về hiện trạng, và nó hết đúng ngay khi trang lên — nên nó phải có test canh,
 * không chỉ có comment. Test canh giờ là `'tổng 38 URL'` cộng
 * `'URL vùng suy ra TỪ REGIONS'`.
 */
const STATIC_PAGES: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/tours', priority: 0.9 },
  { path: '/destinations', priority: 0.9 },
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
 * `lastModified` CHỈ điền khi có ngày thật trong dữ liệu: bài blog có `date`
 * (Task 9 — VM `JournalPost` từ API không còn `updated` riêng, `publishedAt`
 * là ngày thật duy nhất nó biết), còn tour thì contract không trả ngày nào
 * nên bỏ trống. Hai lý do không bịa bằng `new Date()`: nó nói với crawler một
 * điều không đúng, và nó làm output build phụ thuộc thời điểm chạy — cùng một
 * commit sinh ra hai sitemap khác nhau. Khi contract mở `updatedAt` cho tour
 * thì sửa test trước.
 */
export function sitemapEntries(
  tours: readonly MockTourCard[],
  // Pick hẹp thay vì nguyên `JournalPost`: hàm này chỉ cần 2 field, và Pick hẹp
  // giữ fixture test nhỏ (không phải khai đủ title/excerpt/... cho mỗi bài).
  posts: readonly Pick<JournalPost, 'slug' | 'date'>[],
  // Nhận qua THAM SỐ chứ không `import { REGIONS }` tại đây, dù plan Task 6 viết
  // theo lối import: hàm này thuần và test được chính vì mọi nguồn dữ liệu đều đi
  // vào từ ngoài, và `sitemap.spec.ts` dựng được fixture nhỏ nhờ thế. Thêm một
  // import ẩn là mở lỗ đầu tiên trong tính chất đó.
  regions: readonly MockRegion[],
): SitemapEntry[] {
  return [
    ...STATIC_PAGES.map(({ path, priority }) => ({ url: absoluteUrl(path), priority })),
    ...tours.map((tour) => ({ url: absoluteUrl(`/tours/${tour.slug}`), priority: 0.8 })),
    // Cùng bậc 0.8 với tour detail, và **cùng nguồn `REGIONS` với
    // `generateStaticParams`** của `destinations/[region]/page.tsx`. Lệch nguồn là
    // sitemap liệt kê URL không được prerender (crawler ăn 404) hoặc bỏ sót trang đã
    // prerender — đúng lỗi vừa vá. Không có `lastModified`: vùng là dữ liệu dẫn xuất
    // từ tours, không có ngày sửa nào nói thật được.
    ...regions.map((region) => ({
      url: absoluteUrl(`/destinations/${region.slug}`),
      priority: 0.8,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.date,
      priority: 0.6,
    })),
  ];
}
