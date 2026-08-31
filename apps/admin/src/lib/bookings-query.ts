import { BookingStatusSchema, type BookingStatusValue } from '@tourism/contract';

/**
 * Trạng thái danh sách `/bookings` sống TRÊN URL (spec P4b §2.2): server
 * component đọc `searchParams` → input contract; bảng client đổi trang/filter
 * bằng cách điều hướng sang URL mới, KHÔNG fetch từ browser. Hai hàm thuần ở
 * đây là toàn bộ luật dịch giữa hai đầu — test phủ mọi nhánh clamp/lọc.
 */

/** `limit` mặc định của `AdminBookingsListQuerySchema` — giữ khớp với server. */
export const ADMIN_BOOKINGS_PAGE_SIZE = 20;

/** Trần `search` của contract (`z.string().max(120)`). */
const SEARCH_MAX_LENGTH = 120;

/** Hình dạng `searchParams` Next trao cho trang: một key có thể lặp thành mảng. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Input đã sạch cho `admin.bookings.list` (khớp AdminBookingsListQuerySchema). */
export interface BookingsQuery {
  page: number;
  limit: number;
  status?: BookingStatusValue;
  search?: string;
}

/** Param lặp (`?page=2&page=9`) — lấy giá trị đầu, đúng nếp Next đọc query. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * URL là thứ NGƯỜI gõ được: mọi giá trị rác phải rơi về mặc định an toàn chứ
 * không được ném lên tận API (400 vô nghĩa với admin). Page rác → 1, status
 * ngoài enum → bỏ filter, `q` rỗng → không lọc, `q` quá dài → cắt đúng trần.
 */
export function parseBookingsSearchParams(raw: RawSearchParams): BookingsQuery {
  const page = Number(first(raw.page));
  const status = BookingStatusSchema.safeParse(first(raw.status));
  const search = first(raw.q)?.trim().slice(0, SEARCH_MAX_LENGTH);

  return {
    // Number.isInteger loại luôn NaN/1.5/Infinity — chỉ số nguyên ≥ 1 sống sót.
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    limit: ADMIN_BOOKINGS_PAGE_SIZE,
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
  status?: BookingStatusValue | null;
  search?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter luôn ĐẶT LẠI
 * trang về 1 (trang 5 của bộ lọc cũ hầu như chắc chắn rỗng ở bộ lọc mới), trừ
 * khi chính patch nói rõ trang nào. `page=1` không xuất hiện trên URL — mặc
 * định thì không cần viết ra.
 */
export function bookingsHref(current: BookingsQuery, patch: BookingsHrefPatch): string {
  const status = patch.status === undefined ? current.status : (patch.status ?? undefined);
  const rawSearch = patch.search === undefined ? current.search : (patch.search ?? undefined);
  const search = rawSearch?.trim().slice(0, SEARCH_MAX_LENGTH) || undefined;

  const filtersChanged = patch.status !== undefined || patch.search !== undefined;
  const page = patch.page ?? (filtersChanged ? 1 : current.page);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('q', search);
  if (page > 1) params.set('page', String(page));

  const query = params.toString();
  return query ? `/bookings?${query}` : '/bookings';
}
