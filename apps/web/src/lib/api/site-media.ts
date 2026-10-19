import {
  type ContractOutputs,
  isSiteSlotKey,
  type RegionKey,
  type SiteSlotKey,
} from '@tourism/contract';
import { cache } from 'react';
import { api } from './client';
import { TAGS } from './tags';

/** Con số của ADR-0016 §3, cùng cửa sổ với mọi fetch public khác. */
const REVALIDATE_SEC = 300;

export type SiteMediaEntry = ContractOutputs['siteMedia']['list'][number];
export type SiteMediaItem = SiteMediaEntry['media'][number];

/**
 * Khoá khe panel ảnh của sáu trang auth.
 *
 * ── VÌ SAO HẰNG NÀY NẰM Ở ĐÂY, KHÔNG PHẢI Ở `auth-screen.tsx` ──
 * Đặt nó cạnh component là chỗ trực giác hơn, và tôi đã làm vậy trước — nhưng
 * `auth-screen.tsx` là `'use client'`. Khi một SERVER component import bất kỳ
 * export nào từ module client, bundler của Next thay nó bằng **client-reference
 * proxy**: `typeof` ra `'function'`, `JSON.stringify` ra `undefined`. Hằng
 * chuỗi vì thế KHÔNG còn là chuỗi, `map.has(HẰNG)` luôn false, và **không có
 * lỗi nào được ném ra** — trang lặng lẽ vẽ ô giữ chỗ như thể khe chưa có ảnh.
 *
 * Đo được: `map.size` 25 và `[...map.keys()]` có `auth-panel`, nhưng
 * `map.has(AUTH_PANEL_SLOT)` false trong khi `map.has('auth-panel')` true.
 *
 * Luật rút ra: hằng dùng chung giữa server và client phải sống ở module KHÔNG
 * có `'use client'`. File này là chỗ đúng — nó vốn đã là nơi biết về khe.
 */
export const AUTH_PANEL_SLOT: SiteSlotKey = 'auth-panel';

/**
 * Các khe brand-chrome (`home-hero`, `about-hero`, `about-story`, `auth-panel`…).
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
 *
 * Khoá là `SiteSlotKey` của danh mục khe ở contract (ADR-0059 §1): gõ sai khoá là
 * lỗi typecheck, thay vì một ô giữ chỗ lặng lẽ trên site thật.
 */
export async function siteMediaImage(key: SiteSlotKey): Promise<SiteMediaItem | null> {
  const map = await fetchSiteMedia();
  return map.get(key)?.[0] ?? null;
}

/**
 * Ảnh của nhiều khe một lượt, thành bản tra cứu khoá → ảnh — khuôn mà các khối có
 * nhiều khe (Why choose us, bento, timeline, Team) truyền xuống bằng MỘT prop. Vẫn
 * một lần gọi mạng: mọi lần hỏi đi qua `fetchSiteMedia` có `cache()`.
 */
export async function siteMediaImages<K extends SiteSlotKey>(
  keys: readonly K[],
): Promise<Record<K, SiteMediaItem | null>> {
  const entries = await Promise.all(keys.map(async (key) => [key, await siteMediaImage(key)]));
  return Object.fromEntries(entries) as Record<K, SiteMediaItem | null>;
}

/**
 * Khoá ghép chuỗi của trang vùng — `region-gallery-<vùng>-<n>` (ô ảnh) và
 * `region-signature-<vùng>-<n>` (bưu thiếp), `n` đếm từ 1 theo thứ tự ô. Trả `null`
 * khi khoá ghép ra không có trong danh mục; `site-media.spec.ts` canh mọi khoá mà
 * ba trang vùng thật sự ghép đều có, nên nhánh `null` chỉ là lưới.
 */
export function regionSlotKey(
  kind: 'gallery' | 'signature',
  region: RegionKey,
  n: number,
): SiteSlotKey | null {
  const key = `region-${kind}-${region}-${n}`;
  return isSiteSlotKey(key) ? key : null;
}

/** Ảnh của một khe ghép chuỗi; khoá không có trong danh mục thì như khe trống. */
export async function regionSlotImage(
  kind: 'gallery' | 'signature',
  region: RegionKey,
  n: number,
): Promise<SiteMediaItem | null> {
  const key = regionSlotKey(kind, region, n);
  return key === null ? null : siteMediaImage(key);
}
