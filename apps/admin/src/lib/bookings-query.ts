import { BookingStatusSchema, type BookingStatusValue } from '@tourism/contract';
import {
  appendPaging,
  firstParam,
  parsePaging,
  type RawSearchParams,
  resolvePagePatch,
  tableHref,
} from './table-query';

/**
 * Trạng thái danh sách `/bookings` sống TRÊN URL (spec P4b §2.2): server
 * component đọc `searchParams` → input contract; bảng client đổi trang/filter
 * bằng cách điều hướng sang URL mới, KHÔNG fetch từ browser. Hai hàm thuần ở
 * đây là toàn bộ luật dịch giữa hai đầu — test phủ mọi nhánh clamp/lọc.
 *
 * Phân trang (clamp page/limit, ghi query) dùng CHUNG `table-query.ts` với
 * vùng cancellations — tách ở F3 khi vùng thứ hai tiêu thụ đúng luật ấy
 * (§2.1). Ở lại đây: filter riêng của bookings (status + search) và đường dẫn.
 */

/** Trần `search` của contract (`z.string().max(120)`). */
const SEARCH_MAX_LENGTH = 120;

/** Input đã sạch cho `admin.bookings.list` (khớp AdminBookingsListQuerySchema). */
export interface BookingsQuery {
  page: number;
  limit: number;
  status?: BookingStatusValue;
  search?: string;
}

/**
 * URL là thứ NGƯỜI gõ được: mọi giá trị rác phải rơi về mặc định an toàn chứ
 * không được ném lên tận API (400 vô nghĩa với admin). Page rác → 1, status
 * ngoài enum → bỏ filter, `q` rỗng → không lọc, `q` quá dài → cắt đúng trần.
 */
export function parseBookingsSearchParams(raw: RawSearchParams): BookingsQuery {
  const status = BookingStatusSchema.safeParse(firstParam(raw.status));
  const search = firstParam(raw.q)?.trim().slice(0, SEARCH_MAX_LENGTH);

  return {
    ...parsePaging(raw),
    ...(status.success ? { status: status.data } : {}),
    ...(search ? { search } : {}),
  };
}

/**
 * Sửa đổi mong muốn trên URL hiện tại. `undefined` = giữ nguyên field đó,
 * `null` = XOÁ filter — hai ý nghĩa khác nhau nên không gộp được.
 */
export interface BookingsHrefPatch {
  page?: number;
  limit?: number;
  status?: BookingStatusValue | null;
  search?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (trang 5 của bộ lọc/cỡ trang cũ hầu như chắc
 * chắn rỗng ở bộ mới), trừ khi chính patch nói rõ trang nào. `page=1` và
 * `limit` mặc định không xuất hiện trên URL — mặc định thì không cần viết ra.
 */
export function bookingsHref(current: BookingsQuery, patch: BookingsHrefPatch): string {
  const status = patch.status === undefined ? current.status : (patch.status ?? undefined);
  const rawSearch = patch.search === undefined ? current.search : (patch.search ?? undefined);
  const search = rawSearch?.trim().slice(0, SEARCH_MAX_LENGTH) || undefined;

  // Luật reset-page nằm MỘT chỗ ở kit (`resolvePagePatch`) — vùng chỉ khai
  // filter nào tính là "đổi scope" (review F3 31/08).
  const scopeChanged =
    patch.status !== undefined || patch.search !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('q', search);
  appendPaging(params, paging);

  return tableHref('/bookings', params);
}
