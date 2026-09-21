import { CalendarMonthSchema } from '@tourism/contract';
import { currentMonth, formatMonthLabel, type MonthOption, shiftMonth } from './month-options';
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
 * Trạng thái bảng `/tours` sống TRÊN URL (spec P4e-1 §3-F11, cùng khuôn
 * `subscribers-query.ts`/`outbox-query.ts`): server component đọc
 * `searchParams` → input contract; bảng client đổi trang/lọc bằng điều hướng,
 * KHÔNG fetch từ browser.
 *
 * Ba filter, và cái thứ ba KHÔNG giống hai cái kia:
 *
 * - `category` và `published` lọc BỚT HÀNG như mọi bảng khác.
 * - `month` KHÔNG lọc hàng nào. Nó đổi KHOẢNG ĐẾM của cột "Open departures"
 *   (xem `AdminToursListQuerySchema`): tour không chạy tháng đó vẫn có mặt với
 *   số 0. Nhờ vậy lia qua các tháng là so sánh được, vì danh sách đứng yên.
 *
 * Mặc định của `month` là VẮNG MẶT, và vắng mặt nghĩa là "từ hôm nay trở đi"
 * — khác `/reports`, nơi `?month=` luôn phải có mặt trên URL vì "tháng hiện
 * tại" của một báo cáo đổi nghĩa mỗi đầu tháng. Ở đây "sắp tới" là một khái
 * niệm ỔN ĐỊNH (luôn tính từ hôm nay), nên một bookmark trần vẫn đúng mãi.
 */

/** Input đã sạch cho `admin.tours.list` (khớp `AdminToursListQuerySchema`). */
export interface ToursQuery {
  page: number;
  limit: number;
  categoryId?: string;
  /** `true` = đang bán · `false` = đang ẩn · vắng = mọi tour. */
  isPublished?: boolean;
  /** Vắng = đếm chuyến từ hôm nay trở đi. */
  month?: string;
}

/** Số tháng bày trong ô chọn — một năm tới là khoảng lịch khởi hành người thật dựng. */
const MONTH_OPTION_COUNT = 12;

/** uuid v4 của `categoryId` — cùng thứ `z.uuid()` bên contract nhận. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * URL là thứ NGƯỜI gõ được: mọi giá trị rác rơi về mặc định AN TOÀN chứ không
 * ném 400 lên API. `published` chỉ nhận đúng "true"/"false" — mỗi người viết
 * URL một kiểu ("1"/"yes"/"on") là chỗ hai người đọc cùng một link ra hai bảng
 * khác nhau; `month` đi qua CHÍNH schema của contract nên cái gì lọt qua đây
 * thì server cũng nhận.
 *
 * Tháng ĐÃ QUA cố ý KHÔNG bị loại (khác `REPORTS_FIRST_MONTH` của `/reports`):
 * "tháng trước còn chuyến nào tôi quên đóng không" là một câu hỏi vận hành
 * thật, và cửa sổ đếm bên API là tuyệt đối nên nó trả lời được.
 */
export function parseToursSearchParams(raw: RawSearchParams): ToursQuery {
  const categoryId = firstParam(raw.category);
  const published = firstParam(raw.published);
  const month = CalendarMonthSchema.safeParse(firstParam(raw.month));

  return {
    ...parsePaging(raw),
    ...(categoryId && UUID_PATTERN.test(categoryId) ? { categoryId } : {}),
    ...(published === 'true' || published === 'false' ? { isPublished: published === 'true' } : {}),
    ...(month.success ? { month: month.data } : {}),
  };
}

/**
 * Sửa đổi mong muốn trên URL hiện tại. `undefined` = giữ nguyên field đó,
 * `null` = XOÁ filter — hai ý nghĩa khác nhau nên không gộp được (luật chung ở
 * kit `pickPatch`). Với `isPublished`, `false` là một GIÁ TRỊ (tab "Off sale"),
 * không phải cách nói "xoá".
 */
export interface ToursHrefPatch {
  page?: number;
  limit?: number;
  categoryId?: string | null;
  isPublished?: boolean | null;
  month?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật ở kit `resolvePagePatch`), trừ khi chính
 * patch nói rõ trang nào.
 *
 * `month` CÓ nằm trong `scopeChanged` dù nó không lọc bớt hàng: nó đổi con số
 * người ta đang đọc trên mọi hàng, nên ở lại trang 7 của bộ lọc cũ là giữ đúng
 * cái trang không ai đang nhìn.
 */
export function toursHref(current: ToursQuery, patch: ToursHrefPatch): string {
  const scopeChanged =
    patch.categoryId !== undefined ||
    patch.isPublished !== undefined ||
    patch.month !== undefined ||
    patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  // Thứ tự param CỐ ĐỊNH để href ổn định giữa hai lần render.
  const categoryId = pickPatch(patch.categoryId, current.categoryId);
  const isPublished = pickPatch(patch.isPublished, current.isPublished);
  const month = pickPatch(patch.month, current.month);
  if (categoryId) params.set('category', categoryId);
  if (isPublished !== undefined) params.set('published', String(isPublished));
  if (month) params.set('month', month);
  appendPaging(params, paging);

  return tableHref('/tours', params);
}

/** Màn chuyến khởi hành của một tour (F12 dựng). */
export function departuresHref(slug: string): string {
  return `/tours/${slug}/departures`;
}

/**
 * Các tháng trong ô chọn: tháng NÀY rồi lần lượt tới tương lai — ngược chiều
 * với `monthOptions` của `/reports`, vì ở đây người ta hỏi "sắp tới" chứ không
 * phải "vừa rồi".
 *
 * `selected` được CHÈN lên đầu nếu nằm ngoài dải (link cũ, `?month=` gõ tay,
 * một tháng đã qua): thiếu bước đó thì ô chọn hiện một tháng còn con số trong
 * bảng đếm theo một tháng khác — hai thứ cãi nhau ngay trên cùng màn hình.
 */
export function departureMonthOptions(
  now: Date,
  count = MONTH_OPTION_COUNT,
  selected?: string,
): MonthOption[] {
  const first = currentMonth(now);
  const values: string[] = [];
  for (let index = 0; index < count; index++) values.push(shiftMonth(first, index));
  if (selected && !values.includes(selected)) values.unshift(selected);
  return values.map((value) => ({ value, label: formatMonthLabel(value) }));
}
