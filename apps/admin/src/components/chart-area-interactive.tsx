'use client';

import type { DashboardPoint } from '@tourism/contract';
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
  CHART_RANGE_DAYS,
  type ChartRange,
  type ChartRowVM,
  chartRangeLabel,
  formatChartDate,
  sliceSeries,
  toChartRows,
} from '@/lib/dashboard-view';

const t = messages.admin.dashboard;

/**
 * Ba cửa sổ thời gian của biểu đồ. Value giữ nguyên `90d`/`30d`/`7d` — chúng
 * là khoá logic mà `CHART_RANGE_DAYS` đọc, không phải chuỗi hiển thị.
 *
 * CỐ Ý không icon (`icon` là tuỳ chọn ở kit): ba mục chỉ khác nhau ở ĐỘ DÀI
 * của cùng một thứ, nên không có ba glyph nào tách được chúng — đắp cùng một
 * icon lịch lên cả ba là thêm nhiễu mà không thêm nghĩa. Cùng lý do đã bỏ
 * icon ở bộ chọn dải này mà giữ ở bộ lọc trạng thái, nơi mỗi mục là một khái
 * niệm riêng.
 */
const RANGE_ITEMS: { label: string; value: ChartRange }[] = [
  { label: t.chart.range90d, value: '90d' },
  { label: t.chart.range30d, value: '30d' },
  { label: t.chart.range7d, value: '7d' },
];

/**
 * MỘT chuỗi, MỘT trục (P4d, ADR-0036 §2). Block `dashboard-01` vẽ hai diện
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
  points,
  currency,
}: {
  /** Chuỗi 90 ngày từ `admin.stats.dashboard` — bộ chọn cắt đuôi ở client. */
  points: DashboardPoint[];
  currency: string;
}) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState<ChartRange>('90d');

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange('7d');
    }
  }, [isMobile]);

  // Cắt đuôi theo dải rồi dựng hàng — hai phép thuần, có spec ở
  // `dashboard-view.spec.ts`. Không có fetch nào khi đổi dải: 90 point đã tải.
  const visible = React.useMemo(
    () => sliceSeries(points, CHART_RANGE_DAYS[timeRange]),
    [points, timeRange],
  );
  const rows = React.useMemo(() => toChartRows(visible, currency), [visible, currency]);
  const range = chartRangeLabel(visible);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t.chart.title}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {t.chart.description}
            {range ? ` · ${t.chart.showing(range)}` : null}
          </span>
          {/* Màn hẹp: chỉ dải ngày — câu mô tả đầy đủ không có chỗ. */}
          <span className="@[540px]/card:hidden">{range ? t.chart.showing(range) : null}</span>
        </CardDescription>
        <CardAction>
          {/* Dùng lại `StatusFilterTabs` của kit (01/09) thay cặp
              ToggleGroup-outline + Select tự dựng của block `dashboard-01`:
              cụm này là một BỘ CHỌN DẢI y hệt bộ lọc trạng thái ở ba bảng
              vùng, nên nó phải trông y hệt — kể cả viên pill trượt.

              Đổi lại một điểm: kit lật giữa dải nút và Select ở `@4xl/main`,
              còn bản cũ ở `@[767px]/card`. Chấp nhận, và đó là cái ĐÚNG hơn —
              mọi bộ chọn trong admin giờ lật cùng một chỗ thay vì mỗi cái
              một ngưỡng. */}
          <StatusFilterTabs
            items={RANGE_ITEMS}
            value={timeRange}
            label={t.chart.rangeLabel}
            selectId="chart-range-selector"
            // Kit trả `string`; ba value đều là `ChartRange` nên thu hẹp ở đây.
            onSelect={(value) => setTimeRange(value as ChartRange)}
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
                  indicator="dot"
                  // Chữ in từ `revenueLabel` (chuỗi thập phân của contract đã
                  // format) chứ không từ số `value` recharts đưa — tiền không
                  // đi qua float ở bước in. Dòng phụ: số đơn mang tiền ấy.
                  formatter={(_value, _name, item) => {
                    const row = item.payload as ChartRowVM;
                    return (
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between gap-4 leading-none">
                          <span className="text-muted-foreground">{t.chart.revenue}</span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {row.revenueLabel}
                          </span>
                        </div>
                        <span className="text-muted-foreground">{row.bookingsLabel}</span>
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
