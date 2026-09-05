import {
  type AdminDashboardSeries,
  DASHBOARD_RANGE_DAYS,
  type DashboardPoint,
  type DashboardRangeDays,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount } from './bookings-view';
import { statsRangeLabel } from './stats-view';

/**
 * Phần THUẦN của biểu đồ dashboard (ADR-0036 §2) — nằm ngoài React nên test
 * được từng nhánh. Trang `/` fetch chuỗi 90 ngày MỘT lần; bộ chọn 7/30/90 chỉ
 * cắt đuôi ở đây. Cắt đuôi là an toàn vì bucket là ngày lịch UTC cố định: 7
 * point cuối của chuỗi 90 CHÍNH LÀ chuỗi 7 ngày, không phải xấp xỉ.
 *
 * Client KHÔNG dựng trục thời gian: server đã trả đủ `days` point và ngày
 * trống đã là 0 — cùng luật "client không tự cắt kỳ" của `stats-view.ts`.
 *
 * Mọi hàm nhận dữ liệu từ API đều phòng thủ như `isPickedPeriod` ở
 * `stats-view.ts`: client oRPC KHÔNG validate response, nên lệch phiên bản
 * lúc deploy (ADR-0024) là một field thiếu đi thẳng tới đây — ngả về rỗng,
 * không ném trong render (vòng vá review 05/09).
 */

const t = messages.admin.dashboard.chart;
const DAY_MS = 86_400_000;

/** `value` của bộ chọn có phải một dải hợp lệ không — MỘT nguồn: `DASHBOARD_RANGE_DAYS`. */
export function isDashboardRangeDays(value: unknown): value is DashboardRangeDays {
  return (DASHBOARD_RANGE_DAYS as readonly number[]).includes(Number(value));
}

/** Nhãn của một dải — copy ở i18n, khoá theo con số. */
export function rangeLabelFor(days: DashboardRangeDays): string {
  return days === 7 ? t.range7d : days === 30 ? t.range30d : t.range90d;
}

/**
 * Các mục của bộ chọn, dài nhất trước, và KHÔNG dài hơn chuỗi server trả:
 * một consumer xin `days=7` (P5 mobile) không được bày tab "Last 3 months"
 * cho một chuỗi 7 point.
 */
export function rangeOptions(maxDays: DashboardRangeDays): { label: string; value: string }[] {
  return [...DASHBOARD_RANGE_DAYS]
    .filter((days) => days <= maxDays)
    .sort((a, b) => b - a)
    .map((days) => ({ label: rangeLabelFor(days), value: String(days) }));
}

/** `days` point cuối — cả chuỗi nếu nó đã ngắn hơn; rỗng nếu API không trả mảng. */
export function sliceSeries(points: DashboardPoint[] | undefined, days: DashboardRangeDays) {
  return Array.isArray(points) ? points.slice(-days) : [];
}

/** Một hàng cho recharts — hình dạng khớp `dataKey` trong `chart-area-interactive.tsx`. */
export interface ChartRowVM {
  date: string;
  /** Số CHỈ để recharts vẽ trục — không in ra từ đây. */
  revenue: number;
  /** Chữ in ở tooltip, format từ chuỗi thập phân của contract (tiền không qua float). */
  revenueLabel: string;
  bookingsLabel: string;
}

export function toChartRows(points: DashboardPoint[], currency: string): ChartRowVM[] {
  return points.map((point) => ({
    date: point.date,
    revenue: Number(point.revenue),
    revenueLabel: formatAmount(point.revenue, currency),
    bookingsLabel: t.bookings(point.bookings),
  }));
}

/**
 * Nhãn tick/tooltip cho một ngày lịch — UTC bắt buộc: `new Date('2026-09-01')`
 * là nửa đêm UTC, đọc theo giờ máy ở múi âm sẽ lùi thành 31/08 (cùng lý do
 * `DAY_FORMAT` của `stats-view.ts`). Chuỗi không đọc được → '' chứ không ném
 * (`Intl.format(Invalid Date)` là RangeError giữa render).
 */
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
export function formatChartDate(date: string): string {
  const instant = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(instant.getTime()) ? '' : DAY_FORMAT.format(instant);
}

/**
 * "Aug 26 – Sep 1, 2026" cho dải ĐANG hiện. Mượn `statsRangeLabel` (nửa-mở)
 * bằng cách đẩy mốc chặn sang 00:00 ngày SAU point cuối — cùng một hàm dựng
 * nhãn khoảng cho cả hàng card lẫn biểu đồ. `undefined` khi chuỗi rỗng hoặc
 * hai đầu không đọc được.
 */
export function chartRangeLabel(points: DashboardPoint[]): string | undefined {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return undefined;
  const fromMs = Date.parse(`${first.date}T00:00:00.000Z`);
  const lastMs = Date.parse(`${last.date}T00:00:00.000Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(lastMs)) return undefined;
  return statsRangeLabel(new Date(fromMs).toISOString(), new Date(lastMs + DAY_MS).toISOString());
}

/**
 * Point cuối có phải HÔM NAY đang chạy không — đọc từ `period.to` server trả
 * (cửa sổ kết ở lúc chốt sổ, ADR-0036 §2), không từ đồng hồ trình duyệt.
 * Đúng thì UI phải nói "today so far": nửa ngày là nửa số, và không nói ra
 * thì diện tích luôn kết bằng một vách đổ.
 */
export function endsInRunningBucket(
  points: DashboardPoint[],
  period: Pick<AdminDashboardSeries['period'], 'to'> | undefined,
): boolean {
  const last = points.at(-1);
  if (!last || typeof period?.to !== 'string') return false;
  return period.to.slice(0, 10) === last.date;
}
