import { ReportMonthSchema } from '@tourism/contract';
import { firstParam, type RawSearchParams, tableHref } from './table-query';

/**
 * Trạng thái trang `/reports` sống TRÊN URL (`?month=YYYY-MM`, spec P4b
 * §3-F6) — cùng nếp với ba bảng vùng: server component đọc `searchParams` →
 * input contract, ô chọn tháng chỉ điều hướng.
 *
 * "Bây giờ" luôn được TRUYỀN VÀO (`now: Date`) chứ không đọc lén bên trong:
 * hàm thuần thì test được mọi tháng, và một trang in ra giấy không được đổi
 * nội dung tuỳ đồng hồ của máy render nó.
 */

/** Input đã sạch cho `admin.reports.monthly`. */
export interface ReportsQuery {
  month: string;
}

/** Số tháng trong ô chọn — một năm gần nhất là khoảng người thật hay so. */
const MONTH_OPTION_COUNT = 12;

/** Tên tháng đầy đủ (English, luật 7) — đọc bằng tay để KHÔNG qua `Intl`
 *  với một `Date` giả, thứ sẽ kéo múi giờ máy vào một nhãn thuần lịch. */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Tháng UTC của một mốc, dạng `YYYY-MM`. */
export function currentMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/**
 * `?month=` rác rơi về tháng hiện tại — cùng mức khoan dung với status/ngày
 * rác ở `/bookings`: URL là thứ người gõ, và một báo cáo 400 vì gõ nhầm là
 * quá đắt. Schema là CHÍNH cái contract dùng, không có bản regex thứ hai.
 */
export function parseReportsSearchParams(raw: RawSearchParams, now: Date): ReportsQuery {
  const parsed = ReportMonthSchema.safeParse(firstParam(raw.month));
  return { month: parsed.success ? parsed.data : currentMonth(now) };
}

/**
 * Link tới báo cáo của một tháng. LUÔN ghi `month` lên URL, khác `page=1` của
 * các bảng: `page=1` là mặc định vĩnh viễn, còn "tháng hiện tại" đổi nghĩa mỗi
 * đầu tháng — một link không ghi tháng sẽ trỏ sang báo cáo KHÁC khi mở lại
 * vào tháng sau.
 */
export function reportsHref(month: string): string {
  return tableHref('/reports', new URLSearchParams({ month }));
}

/** Link tải CSV của đúng tháng đang xem (route handler `/reports/export`). */
export function reportsExportHref(month: string): string {
  return tableHref('/reports/export', new URLSearchParams({ month }));
}

/** `2026-09` → `September 2026`. */
export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

/** Một tháng lịch, đơn vị `YYYY-MM`, để lùi dần mà không đụng `Date`. */
function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  // Đếm theo tổng số tháng rồi tách lại — không có ca riêng nào cho mốc giao
  // năm, và không `Date` nào tham gia nên không có múi giờ nào len vào.
  const total = year * 12 + (monthNumber - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Các tháng trong ô chọn: `count` tháng gần nhất, mới nhất trước.
 *
 * `selected` (tháng đang xem) được CHÈN lên đầu nếu nó nằm ngoài dải — thiếu
 * bước này thì mở một link cũ sẽ thấy ô select hiện một tháng còn báo cáo nói
 * một tháng khác, hai thứ cãi nhau ngay trên cùng màn hình.
 */
export function monthOptions(
  now: Date,
  count = MONTH_OPTION_COUNT,
  selected?: string,
): Array<{ value: string; label: string }> {
  const latest = currentMonth(now);
  const values = Array.from({ length: count }, (_, index) => shiftMonth(latest, -index));
  if (selected && !values.includes(selected)) values.unshift(selected);
  return values.map((value) => ({ value, label: formatMonthLabel(value) }));
}
