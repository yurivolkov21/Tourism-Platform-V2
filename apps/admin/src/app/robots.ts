import type { MetadataRoute } from 'next';

/**
 * Back-office với crawler (ADR-0026 AMEND 3 §A, sửa ở AMEND 4): KHÔNG
 * disallow — cùng lý lẽ `apps/web/src/lib/robots.ts`: chặn crawl thì crawler
 * không bao giờ đọc được `X-Robots-Tag: noindex` (proxy gắn lên mọi
 * response), và URL bị chặn vẫn lên SERP dạng title-only nếu có backlink.
 * Cho crawl → gõ `/bookings` bị proxy đá về `/login` (mang noindex) → thật sự
 * bị loại khỏi chỉ mục. Không sitemap — không có gì để liệt kê. Route này
 * public (PUBLIC_PATHS) và tĩnh — không script, nên không cần nonce.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
  };
}
