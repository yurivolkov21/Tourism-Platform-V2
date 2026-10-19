import { clampSearch, firstParam, pickPatch, type RawSearchParams, tableHref } from './table-query';

/**
 * Trạng thái trang `/media` sống TRÊN URL (spec P4f Media §6): `?tab=queue`, `?used=`, `?show=`,
 * `?q=`. Khác các bảng có phân trang: danh sách đọc trọn một lần và lọc ngay trên trình duyệt
 * (ADR-0060 §2), nên client đổi URL bằng `history.pushState` — server không phải đọc lại.
 */
export type MediaTab = 'inUse' | 'queue';
export type MediaUsedFilter = 'tours' | 'library' | 'posts' | 'site';
export type MediaShowFilter = 'attention' | 'nocredit';

const USED: readonly MediaUsedFilter[] = ['tours', 'library', 'posts', 'site'];
const SHOW: readonly MediaShowFilter[] = ['attention', 'nocredit'];

/** Trần ô tìm — lọc ở client nên không có trần contract; đủ dài cho một tiêu đề bài viết. */
export const MEDIA_SEARCH_MAX = 100;

export interface MediaQuery {
  tab: MediaTab;
  used?: MediaUsedFilter;
  show?: MediaShowFilter;
  search?: string;
}

export const parseMediaUsed = (value: string | undefined): MediaUsedFilter | null =>
  USED.find((option) => option === value) ?? null;

export const parseMediaShow = (value: string | undefined): MediaShowFilter | null =>
  SHOW.find((option) => option === value) ?? null;

/** URL là thứ NGƯỜI gõ được: rác rơi về mặc định an toàn. */
export function parseMediaSearchParams(raw: RawSearchParams): MediaQuery {
  const used = parseMediaUsed(firstParam(raw.used));
  const show = parseMediaShow(firstParam(raw.show));
  const search = clampSearch(firstParam(raw.q), MEDIA_SEARCH_MAX);
  return {
    tab: firstParam(raw.tab) === 'queue' ? 'queue' : 'inUse',
    ...(used ? { used } : {}),
    ...(show ? { show } : {}),
    ...(search ? { search } : {}),
  };
}

/** `undefined` = giữ nguyên, `null` = xoá bộ lọc (luật chung ở kit `pickPatch`). */
export interface MediaHrefPatch {
  tab?: MediaTab;
  used?: MediaUsedFilter | null;
  show?: MediaShowFilter | null;
  search?: string | null;
}

/**
 * Đổi tab GIỮ bộ lọc của In use: tab Cleanup queue không đọc chúng, và quay lại thì người dùng
 * vẫn thấy đúng lưới vừa lọc.
 */
export function mediaHref(current: MediaQuery, patch: MediaHrefPatch): string {
  const tab = patch.tab ?? current.tab;
  const used = pickPatch(patch.used, current.used);
  const show = pickPatch(patch.show, current.show);
  const search = clampSearch(pickPatch(patch.search, current.search), MEDIA_SEARCH_MAX);

  const params = new URLSearchParams();
  // Thứ tự param CỐ ĐỊNH để href ổn định giữa hai lần render.
  if (tab === 'queue') params.set('tab', 'queue');
  if (used) params.set('used', used);
  if (show) params.set('show', show);
  if (search) params.set('q', search);
  return tableHref('/media', params);
}
