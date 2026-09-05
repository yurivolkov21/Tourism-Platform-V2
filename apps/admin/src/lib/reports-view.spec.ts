import type { AdminMonthlyReport } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  reportBookingsTotal,
  reportCsvRows,
  reportPeriodLabel,
  toReportStatCards,
  toReportStatusRows,
  toReportSummaryRows,
} from './reports-view';

/**
 * Mapper hiển thị báo cáo tháng (spec P4b §3-F6) — THUẦN, ngoài React, nên
 * mọi con chữ trên bản in và mọi ô trong file CSV đều test được.
 *
 * Ranh giới giữ chặt như F5: server đã cộng xong, client chỉ ĐỊNH DẠNG. Không
 * có phép cộng/chia nào ở tầng này ngoài tổng cột trạng thái — và chính con
 * số ấy phải khớp `newBookings` của server, nên nó là phép KIỂM CHÉO chứ
 * không phải một nguồn số thứ hai.
 */
const report: AdminMonthlyReport = {
  month: '2026-09',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-10-01T00:00:00.000Z',
  generatedAt: '2026-09-30T12:00:00.000Z',
  currency: 'USD',
  revenue: '1240.50',
  paidBookings: 8,
  newBookings: 11,
  bookingsByStatus: [
    { status: 'PENDING', count: 2 },
    { status: 'PAID', count: 6 },
    { status: 'CANCELLED', count: 1 },
    { status: 'REFUNDED', count: 1 },
    { status: 'PARTIALLY_REFUNDED', count: 1 },
  ],
  refundedTotal: '120.00',
  refunds: 2,
  cancellationsApproved: 1,
  cancellationsDenied: 3,
  reviewsApproved: 5,
  // Cột kết quả kinh doanh (ADR-0033) — thêm ở Task 6 để fixture khớp
  // contract. Mapper hiển thị của chúng dựng ở Task 8; tới đó bộ test này
  // mới có gì để nói về từng con số.
  recognizedRevenue: '2500.00',
  cogsVariable: '210.00',
  cogsFixed: '400.00',
  cogsTotal: '610.00',
  grossProfit: '1890.00',
  grossMarginPct: 0.756,
  taxRate: 0,
  taxAmount: '0.00',
  paymentFees: '0.00',
  netProfit: '1890.00',
  departuresRun: 1,
  costDataMissing: 1,
};

describe('reportPeriodLabel', () => {
  it('in ngày CUỐI TÍNH VÀO, không phải mốc chặn nửa-mở của server', () => {
    // Server trả `to` = 00:00 ngày 1/10 (KHÔNG tính vào). In thẳng con số ấy
    // là nói với admin rằng báo cáo phủ cả ngày 1/10 — sai một ngày.
    expect(reportPeriodLabel(report)).toBe('1 Sep 2026 – 30 Sep 2026');
  });

  it('tháng 2 năm nhuận kết thúc ngày 29', () => {
    expect(
      reportPeriodLabel({
        ...report,
        month: '2024-02',
        from: '2024-02-01T00:00:00.000Z',
        to: '2024-03-01T00:00:00.000Z',
      }),
    ).toBe('1 Feb 2024 – 29 Feb 2024');
  });
});

describe('toReportStatCards', () => {
  it('bốn card đầu trang, tiền theo đồng tiền SERVER nói', () => {
    const cards = toReportStatCards(report);
    expect(cards.map((card) => card.key)).toEqual([
      'revenue',
      'paidBookings',
      'newBookings',
      'refunded',
    ]);
    expect(cards[0]?.value).toBe('$1,240.50');
    expect(cards[3]?.value).toBe('$120.00');
  });

  it('KHÔNG có pill delta — báo cáo tháng không so với kỳ nào', () => {
    // Hai tháng lịch dài khác nhau (28/29/30/31 ngày), nên một mũi tên
    // "±x%" ở đây sẽ là phép so hai kỳ không cùng độ dài — đúng thứ bất
    // biến của stat card cấm.
    for (const card of toReportStatCards(report)) {
      expect(card.delta).toBeUndefined();
      expect(card.deltaGood).toBeUndefined();
    }
  });

  it('caption của mọi card là chính kỳ báo cáo', () => {
    const caption = messages.admin.reports.period('1 Sep 2026', '30 Sep 2026');
    expect(toReportStatCards(report).every((card) => card.caption === caption)).toBe(true);
  });
});

describe('toReportStatusRows', () => {
  it('một hàng mỗi trạng thái, nhãn hiển thị lấy từ i18n', () => {
    const rows = toReportStatusRows(report);
    expect(rows).toHaveLength(report.bookingsByStatus.length);
    expect(rows[0]).toEqual({
      status: 'PENDING',
      label: messages.admin.bookings.status.PENDING,
      count: '2',
    });
  });

  it('tổng hàng chân bảng định dạng GIỐNG các hàng trên — cùng một cột số', () => {
    // Bản đầu F6 in thẳng `report.newBookings` nên cột đọc ra "1,230 / 4 /
    // 1234" (review F6). Số ở chân bảng vẫn là số của SERVER, chỉ đi qua đúng
    // bộ định dạng mà các hàng trên đang dùng.
    expect(reportBookingsTotal({ ...report, newBookings: 1234 })).toBe('1,234');
    expect(reportBookingsTotal({ ...report, newBookings: 0 })).toBe('0');
  });

  it('trạng thái 0 vẫn có hàng — số 0 là một câu trả lời', () => {
    const zeroed = { ...report, bookingsByStatus: [{ status: 'PAID' as const, count: 0 }] };
    expect(toReportStatusRows(zeroed)).toEqual([
      { status: 'PAID', label: messages.admin.bookings.status.PAID, count: '0' },
    ]);
  });
});

describe('toReportSummaryRows', () => {
  it('bảng metric/value phủ đủ tiền + vận hành', () => {
    const rows = toReportSummaryRows(report);
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
    expect(byLabel[messages.admin.reports.operationsTable.revenue]).toBe('$1,240.50');
    expect(byLabel[messages.admin.reports.operationsTable.refundedTotal]).toBe('$120.00');
    expect(byLabel[messages.admin.reports.operationsTable.refunds]).toBe('2');
    expect(byLabel[messages.admin.reports.operationsTable.cancellationsApproved]).toBe('1');
    expect(byLabel[messages.admin.reports.operationsTable.cancellationsDenied]).toBe('3');
    expect(byLabel[messages.admin.reports.operationsTable.reviewsApproved]).toBe('5');
  });
});

describe('reportCsvRows', () => {
  const rows = reportCsvRows(report);
  const value = (label: string) => rows.find((row) => row[0] === label)?.[1];

  it('header hai cột Metric/Value từ i18n', () => {
    expect(rows[0]).toEqual([messages.admin.reports.csv.metric, messages.admin.reports.csv.value]);
  });

  it('mang theo siêu dữ liệu kỳ — file rời khỏi màn hình phải tự nói nó là tháng nào', () => {
    expect(value(messages.admin.reports.csv.month)).toBe('2026-09');
    expect(value(messages.admin.reports.csv.periodFrom)).toBe('2026-09-01T00:00:00.000Z');
    expect(value(messages.admin.reports.csv.periodTo)).toBe('2026-10-01T00:00:00.000Z');
    expect(value(messages.admin.reports.csv.generatedAt)).toBe('2026-09-30T12:00:00.000Z');
    expect(value(messages.admin.reports.csv.currency)).toBe('USD');
  });

  it('tiền trong CSV là số THÔ — Excel đọc "$1,240.50" thành text', () => {
    expect(value(messages.admin.reports.operationsTable.revenue)).toBe('1240.50');
    expect(value(messages.admin.reports.operationsTable.refundedTotal)).toBe('120.00');
  });

  it('phân rã trạng thái có hàng riêng cho từng trạng thái', () => {
    expect(value(messages.admin.reports.csv.statusRow('PAID'))).toBe('6');
    expect(value(messages.admin.reports.csv.statusRow('PARTIALLY_REFUNDED'))).toBe('1');
  });

  it('mọi hàng đúng hai ô — lệch một ô là cả file lệch cột', () => {
    expect(rows.every((row) => row.length === 2)).toBe(true);
  });
});
