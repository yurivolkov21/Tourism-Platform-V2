import {
  EmailTypeSchema,
  type EmailTypeValue,
  OutboxStatusSchema,
  type OutboxStatusValue,
} from '@tourism/contract';
import {
  appendPaging,
  clampSearch,
  firstParam,
  parsePaging,
  pickPatch,
  type RawSearchParams,
  resolvePagePatch,
  tableHref,
} from './table-query';

/**
 * Trạng thái bảng `/outbox` sống TRÊN URL (spec P4c §3-F7, cùng khuôn
 * `bookings-query.ts`): server component đọc `searchParams` → input contract;
 * bảng client đổi trang/filter bằng điều hướng, KHÔNG fetch từ browser.
 *
 * Ba filter: `status` (tab), `type` (Select từ enum EmailType), `q` (tìm mã
 * booking/email trong payload + dedupeKey — cách tra "email của đơn BK-XXXX
 * đâu rồi"). Phân trang + luật patch/clamp dùng chung `table-query.ts`.
 */

/** Trần `search` của contract (`z.string().max(120)`). */
const SEARCH_MAX_LENGTH = 120;

/** Input đã sạch cho `admin.outbox.list` (khớp AdminOutboxListQuerySchema). */
export interface OutboxQuery {
  page: number;
  limit: number;
  status?: OutboxStatusValue;
  type?: EmailTypeValue;
  search?: string;
}

/**
 * URL là thứ NGƯỜI gõ được: page rác → 1, status/type ngoài enum → bỏ filter,
 * `q` rỗng → không lọc, `q` quá dài → cắt đúng trần. Không ném 400 lên API.
 */
export function parseOutboxSearchParams(raw: RawSearchParams): OutboxQuery {
  const status = OutboxStatusSchema.safeParse(firstParam(raw.status));
  const type = EmailTypeSchema.safeParse(firstParam(raw.type));
  const search = clampSearch(firstParam(raw.q), SEARCH_MAX_LENGTH);

  return {
    ...parsePaging(raw),
    ...(status.success ? { status: status.data } : {}),
    ...(type.success ? { type: type.data } : {}),
    ...(search ? { search } : {}),
  };
}

/**
 * Sửa đổi mong muốn trên URL hiện tại. `undefined` = giữ nguyên field đó,
 * `null` = XOÁ filter — hai ý nghĩa khác nhau nên không gộp được.
 */
export interface OutboxHrefPatch {
  page?: number;
  limit?: number;
  status?: OutboxStatusValue | null;
  type?: EmailTypeValue | null;
  search?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật ở kit `resolvePagePatch`), trừ khi
 * chính patch nói rõ trang nào. Thứ tự param cố định để href ổn định.
 */
export function outboxHref(current: OutboxQuery, patch: OutboxHrefPatch): string {
  const status = pickPatch(patch.status, current.status);
  const type = pickPatch(patch.type, current.type);
  const search = clampSearch(pickPatch(patch.search, current.search), SEARCH_MAX_LENGTH);

  const scopeChanged =
    patch.status !== undefined ||
    patch.type !== undefined ||
    patch.search !== undefined ||
    patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  if (search) params.set('q', search);
  appendPaging(params, paging);

  return tableHref('/outbox', params);
}
