import {
  BookingStatusSchema,
  type BookingStatusValue,
  CalendarDateSchema,
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
 * Ngày lịch `YYYY-MM-DD` — IMPORT thẳng schema mà contract dùng cho
 * `from`/`to` (hết bản khai lại cục bộ, vòng vá review F6), nên cái gì lọt
 * qua đây thì server cũng nhận và ngược lại: ngày không tồn tại
 * (`2026-02-31`), mốc ISO có giờ, lẫn năm ngoài trần 1900–2099 đều rơi im
 * lặng như status rác — đúng thứ ô `<input type="date">` không bao giờ sinh
 * ra nhưng người gõ URL thì có.
 */
const DateParamSchema = CalendarDateSchema;

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
  /**
   * `true` khi admin CỐ Ý bỏ lọc ngày (`?dates=all`). Khác hẳn "URL trần":
   * URL trần được độn mặc định tháng này, còn cờ này nói "đừng độn".
   *
   * Thiếu nó thì không ai về lại được All: xoá trống hai ô ngày sẽ ra một URL
   * trần, rồi bị parse độn lại đúng cái vừa xoá.
   */
  allDates?: boolean;
}

/**
 * Giá trị `?dates=` duy nhất có nghĩa. Viết TƯỜNG MINH trên URL để trạng thái
 * "xem tất cả" bookmark được và route export hiểu được — cùng cách F10
 * subscribers viết `?active=all`.
 */
const ALL_DATES_PARAM = 'all';

/**
 * Khoảng ngày MẶC ĐỊNH: trọn tháng dương lịch của `now`, tính theo UTC (cùng
 * khung giờ mà `formatDateTime` và sổ cái API dùng — xem `bookings-view`).
 *
 * Số ngày cuối tháng tính bằng lịch (`Date.UTC(y, m, 0)` = ngày 0 của tháng
 * SAU = ngày cuối tháng này), không phải bảng chép tay — năm nhuận tự đúng.
 */
function currentMonthRange(now: Date): { from: string; to: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  const prefix = `${year}-${pad(month + 1)}`;

  return { from: `${prefix}-01`, to: `${prefix}-${pad(lastDay)}` };
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
export function parseBookingsSearchParams(raw: RawSearchParams, now: Date): BookingsQuery {
  const status = BookingStatusSchema.safeParse(firstParam(raw.status));
  const search = clampSearch(firstParam(raw.q), SEARCH_MAX_LENGTH);
  const dates = dateRange(firstParam(raw.from), firstParam(raw.to));

  return {
    ...parsePaging(raw),
    ...(status.success ? { status: status.data } : {}),
    ...(search ? { search } : {}),
    ...resolveDates(dates, firstParam(raw.dates), now),
  };
}

/**
 * Ba trạng thái của bộ lọc ngày, theo thứ tự ưu tiên "cái cụ thể hơn thắng":
 *
 * 1. Có ngày trên URL (dù chỉ một đầu) → dùng đúng thứ người ta viết. KHÔNG
 *    độn nốt đầu còn lại: độn là lặng lẽ thu hẹp thứ vừa được yêu cầu.
 * 2. `?dates=all` → không lọc, và ghi cờ để href sau đó đừng độn lại.
 * 3. URL trần → tháng hiện tại (user chốt 04/09).
 *
 * `dates` rác rơi về (3) chứ không về (2): mở toang cả tập dữ liệu vì một ký
 * tự gõ nhầm là đắt hơn nhiều so với hiện sai một tháng.
 */
function resolveDates(
  dates: { from?: string; to?: string },
  rawDates: string | undefined,
  now: Date,
): { from?: string; to?: string; allDates?: boolean } {
  if (dates.from || dates.to) return dates;
  if (rawDates === ALL_DATES_PARAM) return { allDates: true };
  return currentMonthRange(now);
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

  // `dates=all` chỉ phát khi CỐ Ý: đang ở chế độ All và không đặt ngày mới,
  // hoặc patch vừa xoá trắng ô ngày. Suy nó ra từ "không có ngày nào" thì mọi
  // href dựng từ một query chưa qua parse cũng dính — mà chỉ đường parse mới
  // bảo đảm được cái bất biến "luôn có ngày HOẶC có cờ".
  // `null` HOẶC chuỗi rỗng đều là xoá (đúng hợp đồng `BookingsHrefPatch`,
  // vòng vá review polish 2 — bản đầu chỉ nhận `null` nên xoá bằng '' cho href
  // trần và lượt parse kế độn lại đúng tháng vừa xoá).
  const clearedDates =
    patch.from === null || patch.from === '' || patch.to === null || patch.to === '';
  const params = new URLSearchParams();
  appendFilters(params, {
    status,
    search,
    from,
    to,
    allDates: current.allDates === true || clearedDates,
  });
  appendPaging(params, paging);

  return tableHref('/bookings', params);
}

/** Bộ lọc sau khi áp patch — dùng chung bởi `bookingsHref` và link export. */
function resolveFilters(current: BookingsQuery, patch: BookingsHrefPatch) {
  // Luật patch (`undefined` giữ / `null` xoá) và clamp search là của kit
  // (`table-query.ts`, vòng vá review F7) — vùng chỉ ghép filter của mình.
  return {
    status: pickPatch(patch.status, current.status),
    search: clampSearch(pickPatch(patch.search, current.search), SEARCH_MAX_LENGTH),
    // Ngày rác từ patch bị vứt ở ĐÂY chứ không ném lên URL: một href sinh ra
    // 400 là một cú click chết, và luật khoan dung phải giống hệt đường đọc.
    ...dateRange(pickPatch(patch.from, current.from), pickPatch(patch.to, current.to)),
  };
}

/** Ghi bốn filter của vùng vào query — thứ tự cố định để href ổn định. */
function appendFilters(
  params: URLSearchParams,
  filters: { status?: string; search?: string; from?: string; to?: string; allDates?: boolean },
): void {
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('q', filters.search);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  // Không còn ngày nào thì phải NÓI RA là cố ý. Để URL trần thì lượt parse kế
  // tiếp độn lại tháng này, và ô ngày nảy về đúng cái admin vừa xoá.
  if (!filters.from && !filters.to && filters.allDates) params.set('dates', ALL_DATES_PARAM);
}

/**
 * Tên tham số mang danh sách mã đã tích. Khai ở đây để route export và bên
 * dựng URL đọc CÙNG MỘT chuỗi — gõ tay hai lần là hai bản trôi lệch trong im
 * lặng, và triệu chứng sẽ là "bấm Export mà vẫn ra cả tập".
 */
export const EXPORT_SELECTION_PARAM = 'sel';

/**
 * Link tải CSV (spec P4b §3-F6) — trỏ tới route handler `/bookings/export`.
 *
 * KHÔNG chọn hàng nào: cố ý bỏ `page`/`limit`, vì file là CẢ TẬP đang lọc chứ
 * không phải trang đang xem. Xuất "trang 3, 20 dòng" thì con số trong file
 * không khớp với bất cứ câu hỏi nào mà người xuất đang hỏi.
 */
export function bookingsExportHref(query: BookingsQuery, selected?: readonly string[]): string {
  const params = new URLSearchParams();
  appendFilters(params, query);
  // Có hàng được tích thì URL phải mang THÊM `page`+`limit` — ngược hẳn ca
  // export-all bên trên vốn cố ý bỏ chúng đi.
  //
  // Vì sao ngược: việc chọn hàng khoá trong TRANG ĐANG XEM (bảng ĐẶT LẠI tích
  // mỗi khi query đổi — xem `BookingsTable`), nên `page`+`limit` chính là
  // phạm vi của tập đã tích. Route nhờ đó chỉ lấy đúng một trang rồi giao
  // theo mã, thay vì đi bộ qua tối đa `EXPORT_MAX_ROWS` hàng.
  //
  // Mảng rỗng tính là KHÔNG chọn: `sel=` trống sẽ khiến route rẽ vào nhánh
  // "có chọn" rồi không khớp hàng nào và trả 409 — một lời từ chối cho thứ
  // admin không hề làm.
  if (selected?.length) {
    params.set('page', String(query.page));
    params.set('limit', String(query.limit));
    params.set(EXPORT_SELECTION_PARAM, selected.join(','));
  }
  return tableHref('/bookings/export', params);
}
