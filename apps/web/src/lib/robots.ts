import type { MetadataRoute } from 'next';
import { absoluteUrl, siteUrl } from '@/lib/site';

/**
 * Lõi thuần của app/robots.ts (ADR-0016 AMEND 1 §7, sửa ở AMEND 2) — tách
 * khỏi route để test được ở project node (vitest không quét src/app/**).
 *
 * Mở crawl CHỈ khi host của request TRÙNG host của `NEXT_PUBLIC_SITE_URL`
 * (www thật); preview *.vercel.app, apex, dev, `next start` local → đóng
 * hẳn (nội dung trùng với www thật). Vì sao so HOST lúc request thay vì đọc
 * `VERCEL_ENV` lúc build (vòng vá review W3): `/robots.txt` từng là route
 * tĩnh nướng giá trị lúc build — "Promote to Production" hay rollback một
 * build preview là đóng cả site khỏi index không log, và build ngoài Vercel
 * cũng đóng. So host đúng-theo-kiến-tạo với mọi cách deploy.
 *
 * Production giữ nguyên rule đã có từ đợt trả nợ parity:
 * - `disallow` ghi sẵn cả `/account/`/`/checkout/`; `/api/` chặn luôn vì
 *   oRPC handler không có gì để index. `/account/*` còn noindex qua
 *   `(site)/account/layout.tsx` — cùng lý do dòng dưới.
 * - KHÔNG chặn `/login` và các trang auth: chúng noindex qua metadata của
 *   `(auth)/layout.tsx` — chặn hẳn thì crawler không đọc được `noindex`, và
 *   một trang bị chặn vẫn có thể lên kết quả tìm kiếm nếu nơi khác trỏ tới.
 */
export function robotsFor(input: {
  /** Header `host` của request (kèm port nếu có). */
  requestHost: string | null;
  /** Host của NEXT_PUBLIC_SITE_URL — `new URL(siteUrl()).host`. */
  siteHost: string;
}): MetadataRoute.Robots {
  if (!input.requestHost || input.requestHost.toLowerCase() !== input.siteHost.toLowerCase()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/checkout/', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}

/** Host chuẩn tắc của site — tách để route và test cùng một nguồn. */
export function canonicalSiteHost(): string {
  return new URL(siteUrl()).host;
}
