import type { ContractOutputs } from '@tourism/contract';
import { cache } from 'react';
import { api } from './client';
import { TAGS } from './tags';

/** Con số của ADR-0016 §3, cùng cửa sổ với mọi fetch public khác. */
const REVALIDATE_SEC = 300;

export type SiteMediaEntry = ContractOutputs['siteMedia']['list'][number];
export type SiteMediaItem = SiteMediaEntry['media'][number];

/**
 * Chín khe brand-chrome (`home-hero`, `about-story`, `auth-panel`…).
 *
 * `cache()` của React dedupe trong MỘT lần render: trang chủ có bốn khe, không
 * có nó là bốn lần gọi mạng cho cùng một payload.
 *
 * **API chỉ trả khe CÓ ảnh** (`site-media.service.ts` lọc `media.length > 0`),
 * nên map này thưa là chuyện bình thường, không phải lỗi — khe chưa có ảnh thì
 * component giữ `ImagePlaceholder`.
 */
export const fetchSiteMedia = cache(async (): Promise<Map<string, SiteMediaItem[]>> => {
  const entries = await api.siteMedia.list(
    {},
    { context: { next: { revalidate: REVALIDATE_SEC, tags: [TAGS.SITE_MEDIA] } } },
  );
  return new Map(entries.map((e) => [e.key, e.media]));
});

/**
 * Ảnh đầu tiên của một khe, hoặc `null`.
 *
 * Tách khỏi `fetchSiteMedia` để component không phải tự nhớ luật "khe vắng mặt
 * ≠ lỗi" — mọi khe đều dùng chung một câu hỏi và một câu trả lời.
 */
export async function siteMediaImage(key: string): Promise<SiteMediaItem | null> {
  const map = await fetchSiteMedia();
  return map.get(key)?.[0] ?? null;
}
