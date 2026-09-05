import type { DashboardPoint } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  CHART_RANGE_DAYS,
  chartRangeLabel,
  formatChartDate,
  sliceSeries,
  toChartRows,
} from './dashboard-view';

/**
 * TDD suite (ADR-0036 §2, viết TRƯỚC) cho phần THUẦN của biểu đồ dashboard:
 * cắt đuôi chuỗi 90 ngày theo bộ chọn, dựng hàng cho recharts, và các nhãn.
 * Trục thời gian KHÔNG dựng ở đây — server đã trả đủ point, ngày trống đã 0.
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

  it('returns the whole series when it is already short enough', () => {
    expect(sliceSeries(series(7), 30)).toHaveLength(7);
    expect(sliceSeries([], 7)).toEqual([]);
  });

  it('maps every chart range to a contract-legal day count', () => {
    expect(CHART_RANGE_DAYS).toEqual({ '90d': 90, '30d': 30, '7d': 7 });
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
      bookingsLabel: t.bookings(3),
    });
    expect(rows[1]?.revenue).toBe(0);
    expect(rows[1]?.revenueLabel).toBe('$0.00');
  });

  it('bookings copy is singular/plural aware', () => {
    expect(t.bookings(1)).toBe('1 paid booking');
    expect(t.bookings(0)).toBe('0 paid bookings');
  });
});

describe('labels', () => {
  it('formats a calendar date in UTC — no day shift on negative-offset machines', () => {
    expect(formatChartDate('2026-09-01')).toBe('Sep 1');
  });

  it('range label reads first – last day INCLUSIVE, year once', () => {
    expect(chartRangeLabel(series(7))).toBe('Aug 26 – Sep 1, 2026');
  });

  it('range label spans the new year explicitly and is absent for an empty series', () => {
    expect(
      chartRangeLabel([
        { date: '2025-12-30', revenue: '0.00', bookings: 0 },
        { date: '2026-01-02', revenue: '0.00', bookings: 0 },
      ]),
    ).toBe('Dec 30, 2025 – Jan 2, 2026');
    expect(chartRangeLabel([])).toBeUndefined();
  });
});
