import type { MetadataRoute } from 'next';
import { robotsFor } from '@/lib/robots';

/**
 * Nexora có robots.txt + sitemap.xml, v2 trả nợ parity ở đây; từ W3 rule
 * theo MÔI TRƯỜNG (ADR-0016 AMEND 1 §7): preview/dev đóng hẳn, production
 * mở như cũ. Toàn bộ luật + lý do nằm ở lib/robots.ts (thuần, có test) —
 * file này chỉ đọc VERCEL_ENV rồi gọi.
 */
export default function robots(): MetadataRoute.Robots {
  return robotsFor(process.env.VERCEL_ENV);
}
