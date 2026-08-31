import type { AdminReviewsQuerySchema } from '@tourism/contract';
import type { z } from 'zod';
import {
  appendPaging,
  firstParam,
  parsePaging,
  type RawSearchParams,
  resolvePagePatch,
  tableHref,
} from './table-query';

/**
 * Trạng thái hàng đợi `/reviews` sống TRÊN URL (spec P4b §2.2, §3-F4) — cùng
 * khuôn `bookings-query.ts`/`cancellations-query.ts`, phân trang dùng chung
 * kit `table-query.ts`.
 *
 * Khác hai vùng kia ở HAI chỗ, và cả hai đều là chỗ dễ sai ngầm:
 *
 * 1. Trạng thái duyệt là BOOLEAN ở contract (`isApproved`), không phải enum —
 *    nên URL mang chữ đọc được (`?status=pending|approved`) và `toReviewsList
 *    Input` mới dịch sang boolean. Chọn `status` làm tên param để ba vùng có
 *    cùng văn phạm URL; chữ thường vì đây là khái niệm của UI, không phải
 *    một enum contract (bookings/cancellations dùng CHỮ HOA đúng enum).
 * 2. Field số dòng của `AdminReviewsQuerySchema` tên `pageSize` (nó extend
 *    `PageQuerySchema`), trong khi kit gọi là `limit` — xem `toReviewsList
 *    Input` bên dưới.
 */

/** Trần `search` của contract (`z.string().max(100)`) — bookings là 120. */
const SEARCH_MAX_LENGTH = 100;

/** Hai trạng thái duyệt nhìn từ URL/UI; bỏ trống = tất cả. */
export type ReviewState = 'pending' | 'approved';

const REVIEW_STATES: readonly ReviewState[] = ['pending', 'approved'];

/**
 * Chữ bất kỳ → trạng thái hợp lệ, hoặc `null`. Dùng ở CẢ hai đầu vào: URL
 * (người gõ được) và Tab/Select của toolbar (value lạ khi bị reset) — đúng
 * nếp `safeParse` của hai vùng trước, chỉ khác là ở đây không có enum Zod nào
 * để gọi vì contract khai `isApproved` là boolean.
 */
export function parseReviewState(value: string | undefined): ReviewState | null {
  return REVIEW_STATES.find((state) => state === value) ?? null;
}

/**
 * Input của `admin.reviews.list`, khoá kiểu vào CHÍNH schema contract: đổi
 * tên field bên contract là typecheck đỏ ngay tại hàm map cuối file, không
 * đợi runtime nuốt im lặng.
 */
export type ReviewsListInput = z.input<typeof AdminReviewsQuerySchema>;

/** Trạng thái bảng `/reviews` — tên field theo KIT (`limit`), chưa phải input contract. */
export interface ReviewsQuery {
  page: number;
  limit: number;
  state?: ReviewState;
  search?: string;
}

/**
 * URL là thứ NGƯỜI gõ được: mọi giá trị rác rơi về mặc định an toàn chứ không
 * ném lên tận API (400 vô nghĩa với admin). Status ngoài hai giá trị hợp lệ →
 * bỏ filter, `q` rỗng → không lọc, `q` quá dài → cắt đúng trần contract.
 */
export function parseReviewsSearchParams(raw: RawSearchParams): ReviewsQuery {
  const state = parseReviewState(firstParam(raw.status));
  const search = firstParam(raw.q)?.trim().slice(0, SEARCH_MAX_LENGTH);

  return {
    ...parsePaging(raw),
    ...(state ? { state } : {}),
    ...(search ? { search } : {}),
  };
}

/**
 * Sửa đổi mong muốn trên URL hiện tại. `undefined` = giữ nguyên field đó,
 * `null` = XOÁ filter — hai ý nghĩa khác nhau nên không gộp được (nếp hai
 * vùng trước).
 */
export interface ReviewsHrefPatch {
  page?: number;
  limit?: number;
  state?: ReviewState | null;
  search?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật chung nằm ở kit `resolvePagePatch`).
 */
export function reviewsHref(current: ReviewsQuery, patch: ReviewsHrefPatch): string {
  const state = patch.state === undefined ? current.state : (patch.state ?? undefined);
  const rawSearch = patch.search === undefined ? current.search : (patch.search ?? undefined);
  const search = rawSearch?.trim().slice(0, SEARCH_MAX_LENGTH) || undefined;

  const scopeChanged =
    patch.state !== undefined || patch.search !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (state) params.set('status', state);
  if (search) params.set('q', search);
  appendPaging(params, paging);

  return tableHref('/reviews', params);
}

/**
 * Trạng thái bảng → input `admin.reviews.list`.
 *
 * ⚠️ ĐÂY là chỗ cái bẫy đã ghi sẵn ở JSDoc `TablePaging` sống: kit gọi số
 * dòng là `limit`, `AdminReviewsQuerySchema` gọi là **`pageSize`**. Spread
 * thẳng `{ ...query }` vào input thì Zod (object không strict) STRIP `limit`
 * IM LẶNG, `pageSize` rơi về default 20 — ô "Rows per page" thành nút chết mà
 * không lỗi nào đỏ. Vì thế map TỪNG field một cách tường minh ở đây, và
 * `reviews-query.spec.ts` khoá lại bằng một test parse qua chính schema.
 *
 * Cũng ở đây `state` (chữ của URL) mới thành `isApproved` (boolean của
 * contract) — không lọc thì KHÔNG gửi key nào, đúng nghĩa "mặc định trả tất
 * cả" mà JSDoc contract mô tả.
 */
export function toReviewsListInput(query: ReviewsQuery): ReviewsListInput {
  return {
    page: query.page,
    pageSize: query.limit,
    ...(query.state ? { isApproved: query.state === 'approved' } : {}),
    ...(query.search ? { search: query.search } : {}),
  };
}
