import {
  type AdminReviewsQuerySchema,
  type ReviewModerationState,
  ReviewModerationStateSchema,
} from '@tourism/contract';
import type { z } from 'zod';
import {
  appendPaging,
  clampSearch,
  firstParam,
  parseDateRange,
  parsePaging,
  pickPatch,
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
 * 1. URL mang chữ THƯỜNG (`?status=pending|approved|rejected`) trong khi
 *    bookings/cancellations dùng CHỮ HOA đúng enum contract. Giữ vậy sau
 *    ADR-0031 dù contract nay cũng là enum: chữ hoa ở đây sẽ làm hỏng mọi URL
 *    đã lưu, và `status=pending` đọc dễ hơn `status=PENDING` — nó là khái niệm
 *    của UI, không phải một hằng của DB.
 * 2. Field số dòng của `AdminReviewsQuerySchema` tên `pageSize` (nó extend
 *    `PageQuerySchema`), trong khi kit gọi là `limit` — xem `toReviewsList
 *    Input` bên dưới.
 */

/** Trần `search` của contract (`z.string().max(100)`) — bookings là 120. */
const SEARCH_MAX_LENGTH = 100;

/**
 * BA trạng thái (ADR-0031 §1); bỏ trống = tất cả. Kiểu mượn thẳng contract để
 * thêm một trạng thái ở đó mà quên ở đây là typecheck đỏ, không phải một tab
 * thiếu im lặng.
 */
export type ReviewState = ReviewModerationState;

const REVIEW_STATES: readonly ReviewState[] = ReviewModerationStateSchema.options;

/**
 * Chữ bất kỳ → trạng thái hợp lệ, hoặc `null`. Dùng ở CẢ hai đầu vào: URL
 * (người gõ được) và Tab/Select của toolbar (value lạ khi bị reset) — đúng
 * nếp `safeParse` của hai vùng trước.
 */
export function parseReviewState(value: string | undefined): ReviewState | null {
  return REVIEW_STATES.find((state) => state === value) ?? null;
}

/**
 * Nguồn của review — hai member enum của contract (`AdminReviewsQuerySchema.
 * source`). Trả `null` cho mọi thứ khác, cùng khoan dung với `parseReviewState`.
 *
 * ⚠️ PHÂN BIỆT HOA THƯỜNG, khác `status` ngay bên trên. `status` mang chữ
 * thường vì nó là khái niệm của UI và được dịch sang enum ở `toReviewsList
 * Input`; `source` thì đi THẲNG sang contract nguyên văn, nên `?source=curated`
 * lọt qua sẽ thành một 400 ném vào mặt admin cho một chữ gõ nhầm trên URL.
 */
export type ReviewSourceFilter = 'VERIFIED' | 'CURATED';

const REVIEW_SOURCES: readonly ReviewSourceFilter[] = ['VERIFIED', 'CURATED'];

export function parseReviewSource(value: string | undefined): ReviewSourceFilter | null {
  return REVIEW_SOURCES.find((source) => source === value) ?? null;
}

/**
 * Số sao — bộ lọc DUY NHẤT của vùng đổi KIỂU ở cả hai chiều: URL chỉ có chuỗi,
 * contract muốn `z.int().min(1).max(5)`.
 *
 * Nhận cả `string` (đường URL) lẫn `number` (đường patch của `reviewsHref`)
 * để luật chỉ có MỘT bản: hai hàm cho cùng một luật là hai bản sẽ trôi lệch,
 * và bản trôi ở đây sinh ra href 400 — một cú click chết.
 *
 * Khoá đúng trần contract, không rộng hơn. Ba ca dễ lọt nếu chỉ so `>= 1 &&
 * <= 5`: `'4.5'` (không nguyên), `'five'` (NaN), và `''` — `Number('')` là
 * **0**, cái bẫy của `Number` chứ không phải của người gõ.
 */
export function parseReviewRating(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
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
  /** Nguồn review — enum nguyên văn contract, xem `parseReviewSource`. */
  source?: ReviewSourceFilter;
  /** Số sao 1–5; `undefined` = mọi mức. */
  rating?: number;
  search?: string;
  /** Ngày lịch `YYYY-MM-DD` theo `createdAt` — ngày review được GỬI, TÍNH VÀO. */
  from?: string;
  /** Ngày lịch `YYYY-MM-DD`, cũng TÍNH VÀO — trọn ngày đó. */
  to?: string;
}

/**
 * URL là thứ NGƯỜI gõ được: mọi giá trị rác rơi về mặc định an toàn chứ không
 * ném lên tận API (400 vô nghĩa với admin). Status ngoài hai giá trị hợp lệ →
 * bỏ filter, `q` rỗng → không lọc, `q` quá dài → cắt đúng trần contract.
 */
export function parseReviewsSearchParams(raw: RawSearchParams): ReviewsQuery {
  const state = parseReviewState(firstParam(raw.status));
  const source = parseReviewSource(firstParam(raw.source));
  const rating = parseReviewRating(firstParam(raw.rating));
  const search = clampSearch(firstParam(raw.q), SEARCH_MAX_LENGTH);

  return {
    ...parsePaging(raw),
    ...(state ? { state } : {}),
    ...(source ? { source } : {}),
    ...(rating ? { rating } : {}),
    ...(search ? { search } : {}),
    // Luật ngày (rác rơi im lặng, khoảng ngược giữ `from`) nằm ở kit — ba vùng
    // lọc ngày phải khoan dung y hệt nhau.
    ...parseDateRange(firstParam(raw.from), firstParam(raw.to)),
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
  source?: ReviewSourceFilter | null;
  /** Số ngoài dải 1–5 bị vứt ở `reviewsHref`, không ném lên URL. */
  rating?: number | null;
  search?: string | null;
  /** `null` hoặc chuỗi rỗng (ô date bị xoá trắng) đều là XOÁ đầu đó. */
  from?: string | null;
  to?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật chung nằm ở kit `resolvePagePatch`).
 */
export function reviewsHref(current: ReviewsQuery, patch: ReviewsHrefPatch): string {
  const state = pickPatch(patch.state, current.state);
  const source = pickPatch(patch.source, current.source);
  // Đi qua parser LẦN NỮA dù đã có kiểu `number`: kiểu không chặn được số 9,
  // và luật khoan dung phải giống hệt đường đọc (cùng lý do khối ngày dưới đây).
  const rating = parseReviewRating(pickPatch(patch.rating, current.rating)) ?? undefined;
  const search = clampSearch(pickPatch(patch.search, current.search), SEARCH_MAX_LENGTH);
  // Ngày rác từ patch bị vứt ở ĐÂY chứ không ném lên URL: một href sinh ra
  // 400 là một cú click chết, và luật khoan dung phải giống hệt đường đọc.
  const { from, to } = parseDateRange(
    pickPatch(patch.from, current.from),
    pickPatch(patch.to, current.to),
  );

  const scopeChanged =
    patch.state !== undefined ||
    patch.source !== undefined ||
    patch.rating !== undefined ||
    patch.search !== undefined ||
    patch.limit !== undefined ||
    patch.from !== undefined ||
    patch.to !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (state) params.set('status', state);
  if (search) params.set('q', search);
  if (source) params.set('source', source);
  if (rating) params.set('rating', String(rating));
  if (from) params.set('from', from);
  if (to) params.set('to', to);
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
 * `state` đi thẳng sang contract từ ADR-0031 (trước đó phải dịch sang
 * `isApproved` boolean) — không lọc thì KHÔNG gửi key nào, đúng nghĩa "mặc
 * định trả tất cả" mà JSDoc contract mô tả.
 */
export function toReviewsListInput(query: ReviewsQuery): ReviewsListInput {
  return {
    page: query.page,
    pageSize: query.limit,
    ...(query.state ? { state: query.state } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.rating ? { rating: query.rating } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  };
}
