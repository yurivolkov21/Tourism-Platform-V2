import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { canonicalSiteHost, robotsFor } from '@/lib/robots';

/**
 * Nexora có robots.txt + sitemap.xml, v2 trả nợ parity ở đây; từ W3 rule
 * theo HOST của request (ADR-0016 AMEND 2): chỉ www thật mở crawl, preview/
 * apex/dev đóng hẳn. Route ĐỘNG có chủ đích (đọc `headers()`) — bản tĩnh
 * từng nướng môi trường lúc build, promote/rollback một build preview là
 * đóng site khỏi index. Toàn bộ luật + lý do ở lib/robots.ts (thuần, có test).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHost = (await headers()).get('host');
  return robotsFor({ requestHost, siteHost: canonicalSiteHost() });
}
