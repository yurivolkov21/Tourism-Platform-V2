import {
  CancellationRequestStatusSchema,
  type CancellationRequestStatusValue,
} from '@tourism/contract';
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
 * Trạng thái hàng đợi `/cancellations` sống TRÊN URL (spec P4b §2.2, §3-F3) —
 * cùng khuôn với `bookings-query.ts`, phân trang dùng chung `table-query.ts`.
 *
 * Khác bookings ở HAI chỗ:
 *
 * 1. `AdminCancellationsListQuerySchema` KHÔNG có `search`, nên vùng này
 *    không có ô tìm kiếm — đừng dựng control cho một tham số server không đọc.
 * 2. Khoảng ngày KHÔNG có mặc định và KHÔNG có sentinel `?dates=all`
 *    (ADR-0028 §AMEND). `/bookings` độn tháng hiện tại khi URL trần nên phải
 *    có sentinel để về lại "xem tất cả"; ở đây URL trần CHÍNH LÀ xem tất cả,
 *    và xoá trắng hai ô ngày là đường về hiển nhiên. Lý do khác nhau: sổ thì
 *    đọc theo kỳ, còn hàng đợi việc phải làm thì mặc định phải thấy đủ — giấu
 *    một request tháng trước còn đang REQUESTED là giấu việc.
 */

/** Input đã sạch cho `admin.cancellations.list`. */
export interface CancellationsQuery {
  page: number;
  limit: number;
  status?: CancellationRequestStatusValue;
  /** Ngày lịch `YYYY-MM-DD` theo `createdAt`, TÍNH VÀO (biên nửa-mở do API dịch). */
  from?: string;
  /** Ngày lịch `YYYY-MM-DD`, cũng TÍNH VÀO — trọn ngày đó. */
  to?: string;
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
    // Luật ngày (rác rơi im lặng, khoảng ngược giữ `from`) nằm ở kit —
    // `/bookings` và vùng này phải khoan dung y hệt nhau.
    ...parseDateRange(firstParam(raw.from), firstParam(raw.to)),
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
  /** `null` hoặc chuỗi rỗng (ô date bị xoá trắng) đều là XOÁ đầu đó. */
  from?: string | null;
  to?: string | null;
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
  // Ngày rác từ patch bị vứt ở ĐÂY chứ không ném lên URL: một href sinh ra
  // 400 là một cú click chết, và luật khoan dung phải giống hệt đường đọc.
  const { from, to } = parseDateRange(
    pickPatch(patch.from, current.from),
    pickPatch(patch.to, current.to),
  );

  // Luật reset-page nằm MỘT chỗ ở kit (`resolvePagePatch`, review F3 31/08).
  const scopeChanged =
    patch.status !== undefined ||
    patch.limit !== undefined ||
    patch.from !== undefined ||
    patch.to !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  appendPaging(params, paging);

  return tableHref('/cancellations', params);
}
