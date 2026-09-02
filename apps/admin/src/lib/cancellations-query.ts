import {
  CancellationRequestStatusSchema,
  type CancellationRequestStatusValue,
} from '@tourism/contract';
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
 * Trạng thái hàng đợi `/cancellations` sống TRÊN URL (spec P4b §2.2, §3-F3) —
 * cùng khuôn với `bookings-query.ts`, phân trang dùng chung `table-query.ts`.
 *
 * Khác bookings ở đúng một chỗ: `AdminCancellationsListQuerySchema` KHÔNG có
 * `search`, nên vùng này chỉ mang filter status. Không dựng ô tìm kiếm cho
 * một tham số server không đọc.
 */

/** Input đã sạch cho `admin.cancellations.list`. */
export interface CancellationsQuery {
  page: number;
  limit: number;
  status?: CancellationRequestStatusValue;
}

/**
 * URL là thứ NGƯỜI gõ được: status ngoài enum (kể cả trạng thái của booking,
 * dán nhầm từ `/bookings`) rơi êm về "tất cả" thay vì ném 400 lên API. Bỏ
 * trống status = TẤT CẢ request, đúng như JSDoc của contract.
 */
export function parseCancellationsSearchParams(raw: RawSearchParams): CancellationsQuery {
  const status = CancellationRequestStatusSchema.safeParse(firstParam(raw.status));

  return {
    ...parsePaging(raw),
    ...(status.success ? { status: status.data } : {}),
  };
}

/**
 * Sửa đổi mong muốn trên URL hiện tại. `undefined` = giữ nguyên, `null` =
 * XOÁ filter — hai ý nghĩa khác nhau nên không gộp được (nếp bookings).
 */
export interface CancellationsHrefPatch {
  page?: number;
  limit?: number;
  status?: CancellationRequestStatusValue | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (trang 5 của bộ lọc cũ hầu như chắc chắn rỗng
 * ở bộ mới), trừ khi chính patch nói rõ trang nào.
 */
export function cancellationsHref(
  current: CancellationsQuery,
  patch: CancellationsHrefPatch,
): string {
  const status = pickPatch(patch.status, current.status);

  // Luật reset-page nằm MỘT chỗ ở kit (`resolvePagePatch`, review F3 31/08).
  const scopeChanged = patch.status !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  appendPaging(params, paging);

  return tableHref('/cancellations', params);
}
