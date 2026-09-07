import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/**
 * Lõi thuần của app/robots.ts (ADR-0016 AMEND 1 §7) — tách khỏi route để
 * test được ở project node (vitest không quét src/app/**).
 *
 * Ngoài production (`VERCEL_ENV !== 'production'`: preview Vercel, dev, CI)
 * → đóng hẳn: preview crawl được là nội dung trùng với www thật. Production
 * giữ nguyên rule đã có từ đợt trả nợ parity:
 *
 * - `disallow` ghi sẵn cả `/account/`/`/checkout/`; `/api/` chặn luôn vì
 *   oRPC handler không có gì để index.
 * - KHÔNG chặn `/login` và các trang auth: chúng noindex qua metadata của
 *   `(auth)/layout.tsx` — chặn hẳn thì crawler không đọc được `noindex`, và
 *   một trang bị chặn vẫn có thể lên kết quả tìm kiếm nếu nơi khác trỏ tới.
 */
export function robotsFor(vercelEnv: string | undefined): MetadataRoute.Robots {
  if (vercelEnv !== 'production') {
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
