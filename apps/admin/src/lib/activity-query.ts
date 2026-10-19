import { type ActivityArea, ActivityAreaSchema } from '@tourism/contract';
import { z } from 'zod';
import {
  appendPaging,
  firstParam,
  parseDateRange,
  parsePaging,
  pickPatch,
  type RawSearchParams,
  resolvePagePatch,
  tableHref,
} from './table-query';

/**
 * Trạng thái bảng `/activity` sống TRÊN URL (ADR-0061 §7, spec §6), cùng khuôn
 * `subscribers-query.ts`: server component đọc `searchParams` → input contract; thanh lọc chỉ
 * điều hướng. Bốn bộ lọc: `actor` (một người làm), `area` (một trong 14 khu vực) và khoảng ngày
 * `from`/`to`. URL trần là mọi người, mọi khu vực, mọi ngày.
 */

/** Input đã sạch cho `admin.activity.list` (khớp `AdminActivityListQuerySchema`). */
export interface ActivityQuery {
  page: number;
  limit: number;
  actorId?: string;
  area?: ActivityArea;
  /** Ngày lịch `YYYY-MM-DD` theo `createdAt` (UTC), TÍNH VÀO. */
  from?: string;
  /** Ngày lịch `YYYY-MM-DD`, cũng TÍNH VÀO — trọn ngày đó. */
  to?: string;
}

const ActorIdSchema = z.uuid();

/** URL là thứ NGƯỜI gõ được: id người lạ, khu vực lạ, ngày rác đều rơi im lặng về "không lọc". */
export function parseActivitySearchParams(raw: RawSearchParams): ActivityQuery {
  const actor = ActorIdSchema.safeParse(firstParam(raw.actor));
  const area = ActivityAreaSchema.safeParse(firstParam(raw.area));
  return {
    ...parsePaging(raw),
    ...(actor.success ? { actorId: actor.data } : {}),
    ...(area.success ? { area: area.data } : {}),
    ...parseDateRange(firstParam(raw.from), firstParam(raw.to)),
  };
}

/** `undefined` = giữ nguyên field, `null` (hoặc chuỗi rỗng ở ô ngày) = xoá bộ lọc ấy. */
export interface ActivityHrefPatch {
  page?: number;
  limit?: number;
  actorId?: string | null;
  area?: ActivityArea | null;
  from?: string | null;
  to?: string | null;
}

/** Href mới từ trạng thái hiện tại cộng sửa đổi; đổi bộ lọc hay số dòng là về trang 1. */
export function activityHref(current: ActivityQuery, patch: ActivityHrefPatch): string {
  const scopeChanged =
    patch.actorId !== undefined ||
    patch.area !== undefined ||
    patch.from !== undefined ||
    patch.to !== undefined ||
    patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);
  const actorId = pickPatch(patch.actorId, current.actorId);
  const area = pickPatch(patch.area, current.area);
  const dates = parseDateRange(
    pickPatch(patch.from, current.from),
    pickPatch(patch.to, current.to),
  );

  const params = new URLSearchParams();
  if (actorId) params.set('actor', actorId);
  if (area) params.set('area', area);
  if (dates.from) params.set('from', dates.from);
  if (dates.to) params.set('to', dates.to);
  appendPaging(params, paging);
  return tableHref('/activity', params);
}

/** Giá trị thô của menu Area → khu vực hợp lệ, hoặc `null` (mục "All areas" và mọi thứ lạ). */
export function asActivityArea(value: string): ActivityArea | null {
  const parsed = ActivityAreaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Có bộ lọc nào đang bật không — để chọn câu trống "chưa có gì" hay "không khớp". */
export function hasActivityFilters(query: ActivityQuery): boolean {
  return Boolean(query.actorId || query.area || query.from || query.to);
}
