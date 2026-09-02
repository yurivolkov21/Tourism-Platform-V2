'use client';

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

const t = messages.admin.dashboard;

/**
 * Ba cửa sổ thời gian của biểu đồ. Value giữ nguyên `90d`/`30d`/`7d` — chúng
 * là khoá logic mà `filteredData` bên dưới đọc, không phải chuỗi hiển thị.
 *
 * CỐ Ý không icon (`icon` là tuỳ chọn ở kit): ba mục chỉ khác nhau ở ĐỘ DÀI
 * của cùng một thứ, nên không có ba glyph nào tách được chúng — đắp cùng một
 * icon lịch lên cả ba là thêm nhiễu mà không thêm nghĩa. Cùng lý do đã bỏ
 * icon ở bộ chọn dải này mà giữ ở bộ lọc trạng thái, nơi mỗi mục là một khái
 * niệm riêng.
 */
const RANGE_ITEMS = [
  { label: t.chart.range90d, value: '90d' },
  { label: t.chart.range30d, value: '30d' },
  { label: t.chart.range7d, value: '7d' },
];

import { StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { useIsMobile } from '@/hooks/use-mobile';

export const description = 'An interactive area chart';

// Vòng gọt bước 4 (21/08): data demo (90 ngày visitors giả) DỌN SẠCH theo
// lệnh user — mảng rỗng chờ P4d nối admin-stats; khung chart + bộ chọn
// khoảng ngày GIỮ NGUYÊN kiểu dashboard-01. "Total Visitors" đổi nghĩa thành
// doanh thu theo ngày vì v2 KHÔNG có nguồn visitors (không bảng analytics).
const chartData: { date: string; desktop: number; mobile: number }[] = [];

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  desktop: {
    label: 'Desktop',
    color: 'var(--primary)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState('90d');

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange('7d');
    }
  }, [isMobile]);

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date);
    const referenceDate = new Date('2024-06-30');
    let daysToSubtract = 90;
    if (timeRange === '30d') {
      daysToSubtract = 30;
    } else if (timeRange === '7d') {
      daysToSubtract = 7;
    }
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return date >= startDate;
  });

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t.chart.title}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">{t.chart.description}</span>
          <span className="@[540px]/card:hidden">{t.awaiting}</span>
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
            onSelect={setTimeRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-desktop)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-desktop)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-mobile)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-mobile)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="mobile"
              type="natural"
              fill="url(#fillMobile)"
              stroke="var(--color-mobile)"
              stackId="a"
            />
            <Area
              dataKey="desktop"
              type="natural"
              fill="url(#fillDesktop)"
              stroke="var(--color-desktop)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
