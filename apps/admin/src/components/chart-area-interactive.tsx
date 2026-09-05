'use client';

import type { AdminDashboardSeries, DashboardRangeDays } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@tourism/ui/components/chart';
import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  type ChartRowVM,
  chartRangeLabel,
  endsInRunningBucket,
  formatChartDate,
  isDashboardRangeDays,
  rangeOptions,
  sliceSeries,
  toChartRows,
} from '@/lib/dashboard-view';

const t = messages.admin.dashboard;

/** Dải mặc định trên điện thoại — kế thừa block `dashboard-01`. */
const MOBILE_DAYS: DashboardRangeDays = 7;

/**
 * MỘT chuỗi, MỘT trục (ADR-0036 §2 + AMEND 1). Block `dashboard-01` vẽ hai diện
 * tích xếp chồng (desktop/mobile — cùng đơn vị); ở đây hai con số của một
 * ngày khác ĐƠN VỊ (tiền và số đơn), mà biểu đồ hai trục y là lỗi số một của
 * dataviz — nên doanh thu là diện tích, còn số đơn đã trả đứng trong tooltip
 * làm dòng phụ. Tiêu đề đã gọi tên chuỗi nên không cần chú giải.
 *
 * Màu qua token `--chart-1` (bộ tokens có sẵn cặp sáng/tối), không hex.
 */
const chartConfig = {
  revenue: {
    label: t.chart.revenue,
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function ChartAreaInteractive({
  series,
}: {
  /**
   * Cả response của `admin.stats.dashboard` — không chỉ `points`: `period`
   * nói dải server trả (khoá tab) và bucket cuối có đang chạy không (AMEND 2).
   */
  series: AdminDashboardSeries;
}) {
  const isMobile = useIsMobile();
  const maxDays: DashboardRangeDays = isDashboardRangeDays(series.period?.days)
    ? series.period.days
    : 90;
  const [days, setDays] = React.useState<DashboardRangeDays>(maxDays);
  // Người dùng đã tự chọn dải thì đổi breakpoint KHÔNG được đè lên lựa chọn
  // ấy — bản block ép 7d mỗi lần `isMobile` lật, kể cả sau khi họ vừa bấm
  // "Last 3 months" (vòng vá review 05/09).
  const touched = React.useRef(false);

  React.useEffect(() => {
    if (isMobile && !touched.current) setDays(Math.min(MOBILE_DAYS, maxDays) as DashboardRangeDays);
  }, [isMobile, maxDays]);

  // Cắt đuôi theo dải rồi dựng hàng — hai phép thuần, có spec ở
  // `dashboard-view.spec.ts`. Không có fetch nào khi đổi dải: 90 point đã tải.
  const visible = React.useMemo(() => sliceSeries(series.points, days), [series.points, days]);
  const rows = React.useMemo(
    () => toChartRows(visible, series.currency),
    [visible, series.currency],
  );
  const range = React.useMemo(() => chartRangeLabel(visible), [visible]);
  const running = endsInRunningBucket(visible, series.period);
  const items = React.useMemo(() => rangeOptions(maxDays), [maxDays]);
  const showing = range
    ? running
      ? `${t.chart.showing(range)} · ${t.chart.todayRunning}`
      : t.chart.showing(range)
    : null;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t.chart.title}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {t.chart.description}
            {showing ? ` · ${showing}` : null}
          </span>
          {/* Màn hẹp: dải ngày (+ "today so far") — câu mô tả đầy đủ không có chỗ;
              không có dải thì in mô tả để cụm không trống. */}
          <span className="@[540px]/card:hidden">{showing ?? t.chart.description}</span>
        </CardDescription>
        <CardAction>
          {/* Dùng lại `StatusFilterTabs` của kit (01/09) thay cặp
              ToggleGroup-outline + Select tự dựng của block `dashboard-01`:
              cụm này là một BỘ CHỌN DẢI y hệt bộ lọc trạng thái ở ba bảng
              vùng, nên nó phải trông y hệt — kể cả viên pill trượt. Kit lật
              giữa dải nút và Select ở `@4xl/main`, cùng ngưỡng với mọi bộ
              chọn admin. Mục là số ngày dẫn từ `DASHBOARD_RANGE_DAYS`. */}
          <StatusFilterTabs
            items={items}
            value={String(days)}
            label={t.chart.rangeLabel}
            selectId="chart-range-selector"
            onSelect={(value) => {
              // Kit trả `string`; chỉ nhận đúng ba dải của contract, value lạ
              // bị bỏ qua thay vì thành `slice(NaN)` im lặng.
              if (!isDashboardRangeDays(value)) return;
              touched.current = true;
              setDays(Number(value) as DashboardRangeDays);
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) => formatChartDate(value)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  // Nhãn tooltip là `date` của hàng (chuỗi) — recharts khai
                  // ReactNode nên thu hẹp trước khi format.
                  labelFormatter={(value) => formatChartDate(String(value))}
                  // Có `formatter` là kit KHÔNG vẽ indicator nữa (chart.tsx),
                  // nên chấm màu nối tooltip với diện tích vẽ ngay ở đây —
                  // không khai `indicator="dot"` rồi để nó chết.
                  // Chữ in từ `revenueLabel` (chuỗi thập phân của contract đã
                  // format) chứ không từ số `value` recharts đưa — tiền không
                  // đi qua float ở bước in. Dòng phụ: số đơn mang tiền ấy.
                  formatter={(_value, _name, item) => {
                    const row = item.payload as ChartRowVM;
                    return (
                      <div className="flex flex-1 items-start gap-2">
                        <span
                          className="mt-0.5 size-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: 'var(--color-revenue)' }}
                          aria-hidden="true"
                        />
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex items-center justify-between gap-4 leading-none">
                            <span className="text-muted-foreground">{t.chart.revenue}</span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {row.revenueLabel}
                            </span>
                          </div>
                          <span className="text-muted-foreground">{row.bookingsLabel}</span>
                        </div>
                      </div>
                    );
                  }}
                />
              }
            />
            <Area
              dataKey="revenue"
              type="natural"
              fill="url(#fillRevenue)"
              stroke="var(--color-revenue)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
