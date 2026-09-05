import type { DashboardPoint, DashboardRangeDays } from '@tourism/contract';
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
 */

const t = messages.admin.dashboard.chart;
const DAY_MS = 86_400_000;

/** Ba khoá của bộ chọn (giữ nguyên từ block `dashboard-01`) → độ dài contract. */
export type ChartRange = '90d' | '30d' | '7d';
export const CHART_RANGE_DAYS: Record<ChartRange, DashboardRangeDays> = {
  '90d': 90,
  '30d': 30,
  '7d': 7,
};

/** `days` point cuối — cả chuỗi nếu nó đã ngắn hơn. */
export function sliceSeries(points: DashboardPoint[], days: DashboardRangeDays): DashboardPoint[] {
  return points.slice(-days);
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
 * `DAY_FORMAT` của `stats-view.ts`).
 */
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
export function formatChartDate(date: string): string {
  return DAY_FORMAT.format(new Date(`${date}T00:00:00.000Z`));
}

/**
 * "Aug 26 – Sep 1, 2026" cho dải ĐANG hiện. Mượn `statsRangeLabel` (nửa-mở)
 * bằng cách đẩy mốc chặn sang 00:00 ngày SAU point cuối — cùng một hàm dựng
 * nhãn khoảng cho cả hàng card lẫn biểu đồ. `undefined` khi chuỗi rỗng.
 */
export function chartRangeLabel(points: DashboardPoint[]): string | undefined {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return undefined;
  const to = new Date(Date.parse(`${last.date}T00:00:00.000Z`) + DAY_MS).toISOString();
  return statsRangeLabel(`${first.date}T00:00:00.000Z`, to);
}
