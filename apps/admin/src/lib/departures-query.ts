import { type AdminDepartureStatus, AdminDepartureStatusSchema } from '@tourism/contract';
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
 * MỘT filter duy nhất: `status`. Không có ô tìm kiếm (một chuyến không có
 * chữ nào để tìm) và không có bộ lọc ngày (bảng của một tour hiếm khi quá
 * một trang — lịch 2026 rơi vào khoảng 10 chuyến mỗi tour).
 */

/** Input đã sạch cho `admin.departures.list`. */
export interface DeparturesQuery {
  slug: string;
  page: number;
  limit: number;
  status?: AdminDepartureStatus;
}

/**
 * URL là thứ NGƯỜI gõ được: page/limit rác rơi về mặc định, `status` ngoài
 * enum thì bỏ filter. Không ném 400 lên API.
 */
export function parseDeparturesSearchParams(slug: string, raw: RawSearchParams): DeparturesQuery {
  const status = AdminDepartureStatusSchema.safeParse(firstParam(raw.status));

  return {
    slug,
    ...parsePaging(raw),
    ...(status.success ? { status: status.data } : {}),
  };
}

/** `undefined` = giữ nguyên, `null` = xoá filter (luật chung ở kit `pickPatch`). */
export interface DeparturesHrefPatch {
  page?: number;
  limit?: number;
  status?: AdminDepartureStatus | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật ở kit `resolvePagePatch`).
 */
export function departuresHref(current: DeparturesQuery, patch: DeparturesHrefPatch): string {
  const status = pickPatch(patch.status, current.status);
  const scopeChanged = patch.status !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
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
