import { BookingStatusSchema, type BookingStatusValue } from '@tourism/contract';
import { z } from 'zod';
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

/**
 * Ngày lịch `YYYY-MM-DD` — CÙNG schema mà contract dùng cho `from`/`to`, nên
 * cái gì lọt qua đây thì server cũng nhận (và ngược lại): không có bản regex
 * thứ hai để trôi lệch. Nó loại cả ngày không tồn tại (`2026-02-31`) lẫn mốc
 * ISO có giờ, đúng thứ ô `<input type="date">` không bao giờ sinh ra nhưng
 * người gõ URL thì có.
 */
const DateParamSchema = z.iso.date();

/** Input đã sạch cho `admin.bookings.list` (khớp AdminBookingsListQuerySchema). */
export interface BookingsQuery {
  page: number;
  limit: number;
  status?: BookingStatusValue;
  search?: string;
  /** Ngày lịch `YYYY-MM-DD`, TÍNH VÀO khoảng (biên nửa-mở do API dịch). */
  from?: string;
  /** Ngày lịch `YYYY-MM-DD`, cũng TÍNH VÀO — trọn ngày đó. */
  to?: string;
}

/** Ngày hợp lệ hoặc `undefined` — mọi thứ khác rơi im lặng như status rác. */
function validDate(value: string | undefined): string | undefined {
  const parsed = DateParamSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Khoảng ngày đã sạch. Khoảng NGƯỢC (`from > to`) giữ `from` và BỎ `to`:
 * contract trả 400 cho khoảng ngược, mà một trang admin nổ 500 vì người ta gõ
 * nhầm ngày là quá đắt. Bỏ CẢ HAI thì bảng lặng lẽ hiện mọi booking trong khi
 * URL vẫn mang hai ngày — bỏ đúng đầu bị loại để ô "đến ngày" trống, người gõ
 * thấy ngay cái vừa bị vứt.
 */
function dateRange(rawFrom: string | undefined, rawTo: string | undefined) {
  const from = validDate(rawFrom);
  const to = validDate(rawTo);
  const keepTo = to && (!from || from <= to) ? to : undefined;
  return { ...(from ? { from } : {}), ...(keepTo ? { to: keepTo } : {}) };
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
    ...dateRange(firstParam(raw.from), firstParam(raw.to)),
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
  /** `null` hoặc chuỗi rỗng (ô date bị xoá trắng) đều là XOÁ đầu đó. */
  from?: string | null;
  to?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (trang 5 của bộ lọc/cỡ trang cũ hầu như chắc
 * chắn rỗng ở bộ mới), trừ khi chính patch nói rõ trang nào. `page=1` và
 * `limit` mặc định không xuất hiện trên URL — mặc định thì không cần viết ra.
 */
export function bookingsHref(current: BookingsQuery, patch: BookingsHrefPatch): string {
  const { status, search, from, to } = resolveFilters(current, patch);

  // Luật reset-page nằm MỘT chỗ ở kit (`resolvePagePatch`) — vùng chỉ khai
  // filter nào tính là "đổi scope" (review F3 31/08).
  const scopeChanged =
    patch.status !== undefined ||
    patch.search !== undefined ||
    patch.from !== undefined ||
    patch.to !== undefined ||
    patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  appendFilters(params, { status, search, from, to });
  appendPaging(params, paging);

  return tableHref('/bookings', params);
}

/** Bộ lọc sau khi áp patch — dùng chung bởi `bookingsHref` và link export. */
function resolveFilters(current: BookingsQuery, patch: BookingsHrefPatch) {
  const rawSearch = patch.search === undefined ? current.search : (patch.search ?? undefined);
  const pick = (patched: string | null | undefined, currentValue: string | undefined) =>
    patched === undefined ? currentValue : (patched ?? undefined);

  return {
    status: patch.status === undefined ? current.status : (patch.status ?? undefined),
    search: rawSearch?.trim().slice(0, SEARCH_MAX_LENGTH) || undefined,
    // Ngày rác từ patch bị vứt ở ĐÂY chứ không ném lên URL: một href sinh ra
    // 400 là một cú click chết, và luật khoan dung phải giống hệt đường đọc.
    ...dateRange(pick(patch.from, current.from), pick(patch.to, current.to)),
  };
}

/** Ghi bốn filter của vùng vào query — thứ tự cố định để href ổn định. */
function appendFilters(
  params: URLSearchParams,
  filters: { status?: string; search?: string; from?: string; to?: string },
): void {
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('q', filters.search);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
}

/**
 * Link tải CSV của ĐÚNG tập đang lọc (spec P4b §3-F6) — trỏ tới route handler
 * `/bookings/export`.
 *
 * CỐ Ý bỏ `page`/`limit`: file là CẢ TẬP đang lọc, không phải trang đang xem.
 * Xuất "trang 3, 20 dòng" thì con số trong file không khớp với bất cứ câu hỏi
 * nào mà người xuất đang hỏi.
 */
export function bookingsExportHref(query: BookingsQuery): string {
  const params = new URLSearchParams();
  appendFilters(params, query);
  return tableHref('/bookings/export', params);
}
