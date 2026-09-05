import type { DashboardPoint } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  chartRangeLabel,
  endsInRunningBucket,
  formatChartDate,
  isDashboardRangeDays,
  rangeOptions,
  sliceSeries,
  toChartRows,
} from './dashboard-view';

/**
 * TDD suite (ADR-0036 §2) cho phần THUẦN của biểu đồ dashboard: cắt đuôi
 * chuỗi 90 ngày theo bộ chọn, dựng hàng cho recharts, các nhãn, và lưới
 * phòng thủ cho dữ liệu lệch phiên bản (AMEND 2). Trục thời gian KHÔNG dựng ở
 * đây — server đã trả đủ point, ngày trống đã 0.
 */

const t = messages.admin.dashboard.chart;

/** Chuỗi N ngày kết ở 2026-09-01, doanh thu = số thứ tự để soi thứ tự. */
function series(days: number): DashboardPoint[] {
  const end = Date.UTC(2026, 8, 1);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date, revenue: `${i}.00`, bookings: i % 3 };
  });
}

describe('sliceSeries', () => {
  it('keeps the LAST N points — the tail of a 90-day series IS the N-day series', () => {
    const tail = sliceSeries(series(90), 7);
    expect(tail).toHaveLength(7);
    expect(tail[0]?.date).toBe('2026-08-26');
    expect(tail.at(-1)?.date).toBe('2026-09-01');
  });

  it('returns the whole series when it is already short enough, and [] when the API sent none', () => {
    expect(sliceSeries(series(7), 30)).toHaveLength(7);
    expect(sliceSeries([], 7)).toEqual([]);
    // Lệch phiên bản: field thiếu không được ném `points.slice` giữa render.
    expect(sliceSeries(undefined, 7)).toEqual([]);
  });
});

describe('range selector', () => {
  it('accepts only the three contract ranges, as strings or numbers', () => {
    expect(isDashboardRangeDays('7')).toBe(true);
    expect(isDashboardRangeDays(30)).toBe(true);
    expect(isDashboardRangeDays('42')).toBe(false);
    expect(isDashboardRangeDays('90d')).toBe(false);
    expect(isDashboardRangeDays(undefined)).toBe(false);
  });

  it('offers longest-first, and never a range longer than the series the server sent', () => {
    expect(rangeOptions(90).map((o) => o.value)).toEqual(['90', '30', '7']);
    expect(rangeOptions(7)).toEqual([{ label: t.range7d, value: '7' }]);
  });
});

describe('toChartRows', () => {
  const rows = toChartRows(
    [
      { date: '2026-08-31', revenue: '1240.50', bookings: 3 },
      { date: '2026-09-01', revenue: '0.00', bookings: 0 },
    ],
    'USD',
  );

  it('carries a numeric revenue for the y-scale AND the formatted string for the tooltip', () => {
    // Số chỉ để recharts vẽ; chữ in ra vẫn từ chuỗi thập phân của contract.
    expect(rows[0]).toEqual({
      date: '2026-08-31',
      revenue: 1240.5,
      revenueLabel: '$1,240.50',
      bookingsLabel: '3 paid bookings',
    });
    expect(rows[1]?.revenue).toBe(0);
    expect(rows[1]?.revenueLabel).toBe('$0.00');
    expect(rows[1]?.bookingsLabel).toBe('0 paid bookings');
  });
});

describe('labels', () => {
  it('formats a calendar date in UTC — no day shift on negative-offset machines', () => {
    expect(formatChartDate('2026-09-01')).toBe('Sep 1');
  });

  it('a date the API should never send renders empty instead of throwing mid-render', () => {
    expect(formatChartDate('undefined')).toBe('');
    expect(formatChartDate('')).toBe('');
  });

  it('range label reads first – last day INCLUSIVE, year once', () => {
    expect(chartRangeLabel(series(7))).toBe('Aug 26 – Sep 1, 2026');
  });

  it('range label spans the new year explicitly and is absent for an empty or broken series', () => {
    expect(
      chartRangeLabel([
        { date: '2025-12-30', revenue: '0.00', bookings: 0 },
        { date: '2026-01-02', revenue: '0.00', bookings: 0 },
      ]),
    ).toBe('Dec 30, 2025 – Jan 2, 2026');
    expect(chartRangeLabel([])).toBeUndefined();
    expect(chartRangeLabel([{ date: 'nonsense', revenue: '0.00', bookings: 0 }])).toBeUndefined();
  });
});

describe('endsInRunningBucket', () => {
  it('is true when the last point is the calendar day of period.to — today, still filling', () => {
    expect(endsInRunningBucket(series(7), { to: '2026-09-01T10:30:00.000Z' })).toBe(true);
  });

  it('is false for a closed window, an empty series, or a period the API did not send', () => {
    expect(endsInRunningBucket(series(7), { to: '2026-09-02T00:00:00.000Z' })).toBe(false);
    expect(endsInRunningBucket([], { to: '2026-09-01T10:30:00.000Z' })).toBe(false);
    expect(endsInRunningBucket(series(7), undefined)).toBe(false);
  });
});
