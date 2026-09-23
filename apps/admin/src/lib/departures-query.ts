import { type DeparturePhaseFilter, DeparturePhaseFilterSchema } from '@tourism/contract';
import {
  appendPaging,
  firstParam,
  parsePaging,
  pickPatch,
  type RawSearchParams,
  resolvePagePatch,
  tableHref,
} from './table-query';

/**
 * Trạng thái bảng `/tours/[slug]/departures` sống TRÊN URL (cùng khuôn
 * `enquiries-query.ts`): server component đọc `searchParams` → input contract;
 * bảng client đổi trang/lọc bằng điều hướng, KHÔNG fetch từ browser.
 *
 * Khác mọi vùng admin khác ở một điểm: `slug` KHÔNG đến từ query mà từ ĐOẠN
 * ĐƯỜNG DẪN (`/tours/[slug]/departures`). Nó vẫn nằm trong query object vì
 * contract nhận nó như một input thường — nhưng nó không bao giờ được đọc từ
 * `searchParams`, và `departuresHref` luôn dựng lại đúng đường dẫn của tour
 * đang mở.
 *
 * MỘT filter duy nhất: `phase` — NHÓM giai đoạn của chuyến (spec F16 §2d),
 * không còn là công tắc `status`. Không có ô tìm kiếm (một chuyến không có
 * chữ nào để tìm) và không có bộ lọc ngày (bảng của một tour hiếm khi quá
 * một trang — lịch 2026 rơi vào khoảng 10 chuyến mỗi tour).
 */

/** Input đã sạch cho `admin.departures.list`. */
export interface DeparturesQuery {
  slug: string;
  page: number;
  limit: number;
  phase?: DeparturePhaseFilter;
}

/**
 * URL là thứ NGƯỜI gõ được: page/limit rác rơi về mặc định, `phase` ngoài bốn
 * nhóm (kể cả `status` của URL cũ) thì bỏ filter. Không ném 400 lên API.
 */
export function parseDeparturesSearchParams(slug: string, raw: RawSearchParams): DeparturesQuery {
  const phase = DeparturePhaseFilterSchema.safeParse(firstParam(raw.phase));

  return {
    slug,
    ...parsePaging(raw),
    ...(phase.success ? { phase: phase.data } : {}),
  };
}

/** `undefined` = giữ nguyên, `null` = xoá filter (luật chung ở kit `pickPatch`). */
export interface DeparturesHrefPatch {
  page?: number;
  limit?: number;
  phase?: DeparturePhaseFilter | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật ở kit `resolvePagePatch`).
 */
export function departuresHref(current: DeparturesQuery, patch: DeparturesHrefPatch): string {
  const phase = pickPatch(patch.phase, current.phase);
  const scopeChanged = patch.phase !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (phase) params.set('phase', phase);
  appendPaging(params, paging);

  return tableHref(departuresPath(current.slug), params);
}

/** Đường dẫn bảng chuyến của một tour — một bản, để không nơi nào tự ghép chuỗi. */
export function departuresPath(slug: string): string {
  return `/tours/${slug}/departures`;
}

/**
 * Đường VỀ danh sách tour. Trang `/tours` là của F11; tới khi nhánh đó lên
 * `main`, link này 404 — cố ý, và ghi trong bàn giao. Một breadcrumb trỏ
 * thẳng chỗ đúng vẫn tốt hơn một breadcrumb không có.
 */
export const TOURS_LIST_HREF = '/tours';
