import type { MetadataRoute } from 'next';

/**
 * Back-office đóng hẳn với crawler (ADR-0026 AMEND 3 §A): disallow '/' —
 * khác web, ở đây KHÔNG có trang nào cần "được crawl để đọc noindex" vì
 * X-Robots-Tag đã phủ mọi response qua proxy; robots.txt là lớp lịch sự để
 * crawler tử tế khỏi gõ cửa. Không sitemap — không có gì để liệt kê.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  };
}
