import { ReportMonthSchema } from '@tourism/contract';
import {
  currentMonth,
  formatMonthLabel,
  groupMonthOptions,
  type MonthOption,
  type MonthOptionGroup,
  shiftMonth,
} from './month-options';
import { firstParam, type RawSearchParams, tableHref } from './table-query';

export type { MonthOption, MonthOptionGroup };
/**
 * Số học và nhãn tháng nâng lên `month-options.ts` ở F11 (21/09) khi bộ lọc
 * tháng khởi hành của `/tours` cần đúng chúng. Re-export để mọi chỗ import từ
 * file này — trang `/reports`, menu tháng, spec của cả hai — không phải đổi gì.
 */
export { currentMonth, formatMonthLabel, groupMonthOptions };

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

/**
 * Tháng đầu tiên có báo cáo. Dữ liệu vận hành bắt đầu từ 01/2026 (spec
 * `docs/specs/2026-09-14-seed-khung-2026-design.md`), và user chốt 15/09/2026: ô chọn
 * tháng lẫn `?month=` không bao giờ trỏ một tháng trước mốc này — kể cả khi báo cáo
 * tháng đó chỉ toàn số 0, vì một lựa chọn trống vẫn là thứ tồn đọng trên màn hình.
 */
export const REPORTS_FIRST_MONTH = '2026-01';

/** Số tháng tối đa trong ô chọn — một năm gần nhất là khoảng người thật hay so. */
const MONTH_OPTION_COUNT = 12;

/**
 * `?month=` rác rơi về tháng hiện tại — cùng mức khoan dung với status/ngày
 * rác ở `/bookings`: URL là thứ người gõ, và một báo cáo 400 vì gõ nhầm là
 * quá đắt. Schema là CHÍNH cái contract dùng, không có bản regex thứ hai.
 *
 * Tháng trước `REPORTS_FIRST_MONTH` cũng tính là rác với trang này, nên link cũ
 * hay gõ tay `?month=2025-10` không mở được báo cáo trước mốc dữ liệu. Chuỗi
 * `YYYY-MM` đủ bốn chữ số năm nên so sánh chuỗi đúng thứ tự thời gian.
 */
export function parseReportsSearchParams(raw: RawSearchParams, now: Date): ReportsQuery {
  const parsed = ReportMonthSchema.safeParse(firstParam(raw.month));
  return {
    month: parsed.success && parsed.data >= REPORTS_FIRST_MONTH ? parsed.data : currentMonth(now),
  };
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

/** Link tải file Excel của đúng tháng đang xem (route handler `/reports/export`). */
export function reportsExportHref(month: string): string {
  return tableHref('/reports/export', new URLSearchParams({ month }));
}

/**
 * Các tháng trong ô chọn: tối đa `count` tháng gần nhất, mới nhất trước, dừng ở
 * `REPORTS_FIRST_MONTH` — không bao giờ bày một tháng trước mốc dữ liệu.
 *
 * `selected` (tháng đang xem) được CHÈN lên đầu nếu nó nằm ngoài dải — thiếu
 * bước này thì mở một link cũ sẽ thấy ô select hiện một tháng còn báo cáo nói
 * một tháng khác, hai thứ cãi nhau ngay trên cùng màn hình. Tháng trước sàn thì
 * không bao giờ được chèn (`parseReportsSearchParams` cũng không trả ra nó).
 */
export function monthOptions(
  now: Date,
  count = MONTH_OPTION_COUNT,
  selected?: string,
): Array<{ value: string; label: string }> {
  const latest = currentMonth(now);
  const values: string[] = [];
  for (let index = 0; index < count; index++) {
    const month = shiftMonth(latest, -index);
    if (month < REPORTS_FIRST_MONTH) break;
    values.push(month);
  }
  if (selected && selected >= REPORTS_FIRST_MONTH && !values.includes(selected)) {
    values.unshift(selected);
  }
  return values.map((value) => ({ value, label: formatMonthLabel(value) }));
}
