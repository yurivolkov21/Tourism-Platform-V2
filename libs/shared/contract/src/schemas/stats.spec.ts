import {
  AdminBookingsStatsQuerySchema,
  AdminBookingsStatsSchema,
  AdminCancellationsStatsSchema,
  AdminReviewsStatsSchema,
  CountMetricSchema,
  DecimalMetricSchema,
  MoneyMetricSchema,
  STATS_WINDOW_DAYS,
  StatsPeriodSchema,
} from './stats.js';

const period = {
  windowDays: STATS_WINDOW_DAYS,
  currentFrom: '2026-08-04T00:00:00.000Z',
  currentTo: '2026-09-01T00:00:00.000Z',
  previousFrom: '2026-07-07T00:00:00.000Z',
  generatedAt: '2026-09-01T00:00:00.000Z',
};

describe('metric pairs', () => {
  // Bất biến F5: server trả CẢ HAI số, client không tự chế phép delta — nên
  // thiếu `previous` phải là lỗi schema, không phải một mặc định im lặng.
  it('reject a metric that carries only the current value', () => {
    expect(CountMetricSchema.safeParse({ current: 12 }).success).toBe(false);
    expect(MoneyMetricSchema.safeParse({ current: '120.00' }).success).toBe(false);
    expect(DecimalMetricSchema.safeParse({ current: '4.50' }).success).toBe(false);
  });

  it('counts are non-negative integers', () => {
    expect(CountMetricSchema.parse({ current: 12, previous: 0 })).toEqual({
      current: 12,
      previous: 0,
    });
    expect(CountMetricSchema.safeParse({ current: 1.5, previous: 0 }).success).toBe(false);
    expect(CountMetricSchema.safeParse({ current: -1, previous: 0 }).success).toBe(false);
  });

  it('money stays a decimal string — never a float', () => {
    expect(MoneyMetricSchema.parse({ current: '1240.50', previous: '0.00' }).current).toBe(
      '1240.50',
    );
    expect(MoneyMetricSchema.safeParse({ current: 1240.5, previous: '0.00' }).success).toBe(false);
    expect(MoneyMetricSchema.safeParse({ current: '$1240.50', previous: '0' }).success).toBe(false);
  });

  it('decimal metrics accept null for a period that has no answer', () => {
    // Rate không có mẫu số / kỳ không có review nào: null là câu trả lời
    // THẬT, "0" sẽ nói dối (0% huỷ, 0 sao).
    expect(DecimalMetricSchema.parse({ current: null, previous: '4.50' }).current).toBeNull();
    expect(DecimalMetricSchema.safeParse({ current: undefined, previous: null }).success).toBe(
      false,
    );
  });
});

describe('StatsPeriodSchema', () => {
  it('carries both window edges plus the instant it was computed', () => {
    expect(StatsPeriodSchema.parse(period)).toEqual(period);
  });

  it('rejects a period missing the previous edge — the caption needs it', () => {
    const { previousFrom: _dropped, ...partial } = period;
    expect(StatsPeriodSchema.safeParse(partial).success).toBe(false);
  });
});

describe('AdminBookingsStatsQuerySchema', () => {
  // ADR-0028: card ăn theo bộ lọc ngày của bảng, dùng ĐÚNG hai tên và đúng
  // schema mà `admin.bookings.list` đã dùng — một chữ trên URL nuôi cả hai
  // vùng, không có bản dịch thứ hai để trôi lệch.
  it('accepts a calendar-date range, both ends optional', () => {
    expect(AdminBookingsStatsQuerySchema.parse({})).toEqual({});
    expect(AdminBookingsStatsQuerySchema.parse({ from: '2026-09-01', to: '2026-09-30' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(AdminBookingsStatsQuerySchema.parse({ from: '2026-09-01' })).toEqual({
      from: '2026-09-01',
    });
  });

  it('rejects a reversed range — same rule as admin.bookings.list', () => {
    expect(
      AdminBookingsStatsQuerySchema.safeParse({ from: '2026-09-30', to: '2026-09-01' }).success,
    ).toBe(false);
  });

  it('rejects an instant: the contract only ever takes calendar dates', () => {
    // Phép đổi ngày → mốc (nửa-mở, 00:00:00.000) là chuyện của tầng API; giờ
    // giấc không bao giờ đi qua hợp đồng (ADR-0028 §3).
    expect(
      AdminBookingsStatsQuerySchema.safeParse({ from: '2026-09-01T00:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('rejects a date that does not exist, and a year outside 1900-2099', () => {
    expect(AdminBookingsStatsQuerySchema.safeParse({ from: '2026-02-31' }).success).toBe(false);
    expect(AdminBookingsStatsQuerySchema.safeParse({ to: '0050-06-01' }).success).toBe(false);
  });
});

describe('area stat schemas', () => {
  it('bookings carries revenue, paid, new and cancellation rate', () => {
    const parsed = AdminBookingsStatsSchema.parse({
      period,
      currency: 'USD',
      revenue: { current: '1240.50', previous: '900.00' },
      paidBookings: { current: 12, previous: 9 },
      newBookings: { current: 20, previous: 14 },
      cancellationRate: { current: '8.3', previous: '11.1' },
      // Field lạ bị Zod strip — output không rò rỉ thứ contract không khai.
      leaked: 'nope',
    });
    expect(parsed).not.toHaveProperty('leaked');
    expect(parsed.revenue).toEqual({ current: '1240.50', previous: '900.00' });
    expect(parsed.cancellationRate.current).toBe('8.3');
  });

  it('bookings names the currency it summed — client never guesses one', () => {
    const base = {
      period,
      revenue: { current: '1240.50', previous: '900.00' },
      paidBookings: { current: 12, previous: 9 },
      newBookings: { current: 20, previous: 14 },
      cancellationRate: { current: '8.3', previous: '11.1' },
    };
    expect(AdminBookingsStatsSchema.safeParse(base).success).toBe(false);
    expect(AdminBookingsStatsSchema.parse({ ...base, currency: 'USD' }).currency).toBe('USD');
  });

  it('cancellations carries the live queue plus decisions of the window', () => {
    const parsed = AdminCancellationsStatsSchema.parse({
      period,
      pendingQueue: { current: 3, previous: 5 },
      approved: { current: 4, previous: 2 },
      denied: { current: 1, previous: 0 },
    });
    expect(parsed.pendingQueue).toEqual({ current: 3, previous: 5 });
  });

  it('reviews carries the queue, approvals and an average that may be absent', () => {
    const parsed = AdminReviewsStatsSchema.parse({
      period,
      pending: { current: 7, previous: 2 },
      approved: { current: 5, previous: 6 },
      averageRating: { current: '4.60', previous: null },
    });
    expect(parsed.averageRating).toEqual({ current: '4.60', previous: null });
  });
});
