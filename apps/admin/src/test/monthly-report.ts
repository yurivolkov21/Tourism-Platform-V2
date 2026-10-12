import type { AdminMonthlyReport } from '@tourism/contract';

/**
 * Báo cáo tháng mẫu cho test bản in C2 (G40 Phần 2) — dùng chung cho spec view-model
 * (`lib/report-print.spec.ts`) và spec tờ in (`components/reports/report-print.spec.tsx`).
 *
 * Số của tháng 9 lấy theo bản thảo C2 (`print-report.src.html`), thuế tính đúng công thức của API:
 * `max(0, grossProfit) × rate / (1 + rate)`.
 */
export const septemberReport: AdminMonthlyReport = {
  month: '2026-09',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-10-01T00:00:00.000Z',
  generatedAt: '2026-10-10T02:30:00.000Z',
  currency: 'USD',
  revenue: '31543.39',
  paidBookings: 70,
  newBookings: 71,
  bookingsByStatus: [
    { status: 'PENDING', count: 0 },
    { status: 'PAID', count: 65 },
    { status: 'CANCELLED', count: 6 },
    { status: 'REFUNDED', count: 0 },
    { status: 'PARTIALLY_REFUNDED', count: 0 },
  ],
  refundedTotal: '1826.00',
  refunds: 6,
  cancellationsWithinDeadline: 4,
  cancellationsAfterDeadline: 2,
  reviewsApproved: 10,
  recognizedThrough: '2026-09-30',
  recognizedRevenue: '39607.80',
  cogsVariable: '25737.54',
  cogsFixed: '3952.00',
  cogsTotal: '29689.54',
  grossProfit: '9918.26',
  grossMarginPct: 0.2504,
  taxRate: 0.1,
  taxAmount: '901.66',
  paymentFees: '935.76',
  netProfit: '8080.84',
  departuresRun: 15,
  costDataMissing: 0,
  departuresCostMissing: 0,
};

/** Tháng lỗ: giá vốn vượt doanh thu ghi nhận — lãi gộp và lãi ròng âm, thuế bằng 0. */
export const lossMonthReport: AdminMonthlyReport = {
  ...septemberReport,
  recognizedRevenue: '5000.00',
  cogsVariable: '4000.00',
  cogsFixed: '2000.00',
  cogsTotal: '6000.00',
  grossProfit: '-1000.00',
  grossMarginPct: -0.2,
  taxAmount: '0.00',
  paymentFees: '150.00',
  netProfit: '-1150.00',
};

/** Tháng chưa có chuyến nào kết thúc: bảy giá trị của thác nước đều 0. */
export const emptyMonthReport: AdminMonthlyReport = {
  ...septemberReport,
  recognizedThrough: null,
  recognizedRevenue: '0.00',
  cogsVariable: '0.00',
  cogsFixed: '0.00',
  cogsTotal: '0.00',
  grossProfit: '0.00',
  grossMarginPct: null,
  taxAmount: '0.00',
  paymentFees: '0.00',
  netProfit: '0.00',
  departuresRun: 0,
};
