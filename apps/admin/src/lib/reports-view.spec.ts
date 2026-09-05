import type { AdminMonthlyReport } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  costWarning,
  formatMarginPct,
  reportBookingsTotal,
  reportCsvRows,
  reportPeriodLabel,
  toReportPnlRows,
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
    // Bộ card đổi ở 05/09 (ADR-0033 §1): ba card kinh doanh cộng một card
    // dòng tiền. Danh sách khoá ở `describe('P&L')` bên dưới; ở đây chỉ canh
    // phép định dạng tiền.
    const cards = toReportStatCards(report);

    expect(cards).toHaveLength(4);
    expect(cards[0]?.value).toBe('$2,500.00');
    expect(cards[3]?.value).toBe('$1,240.50');
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

  it('caption là kỳ báo cáo — TRỪ card lợi nhuận gộp, nó mang biên %', () => {
    // Ngoại lệ có chủ đích: một con số lãi mà không có biên thì không so được
    // với tháng khác hay tour khác, còn kỳ báo cáo thì ba card kia đã nói rồi.
    const caption = messages.admin.reports.period('1 Sep 2026', '30 Sep 2026');
    const cards = toReportStatCards(report);

    expect(cards.filter((card) => card.caption === caption)).toHaveLength(3);
    expect(cards.find((card) => card.key === 'grossProfit')?.caption).not.toBe(caption);
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

/**
 * Bảng P&L và bốn card kinh doanh (ADR-0033 §1, và bảng "Hình dạng câu trả
 * lời" của nó).
 *
 * Ranh giới không đổi: server đã cộng xong, tầng này chỉ ĐỊNH DẠNG. Ba chỗ
 * đáng canh là ba chỗ định dạng có thể nói dối — dấu gạch của biên không xác
 * định, dấu trừ của một tháng lỗ, và thuế suất phải hiện trên nhãn.
 */
describe('P&L', () => {
  it('biên gộp in thành phần trăm, và dấu gạch khi KHÔNG XÁC ĐỊNH', () => {
    // `null` là "không có chuyến nào chạy", khác hẳn 0% vốn nói hoà vốn trắng.
    expect(formatMarginPct(0.4)).toBe('40.0%');
    expect(formatMarginPct(-0.15)).toBe('-15.0%');
    expect(formatMarginPct(0)).toBe('0.0%');
    expect(formatMarginPct(null)).toBe('—');
  });

  it('bốn card đổi sang cách đọc kinh doanh, GIỮ một card dòng tiền làm mỏ neo', () => {
    expect(toReportStatCards(report).map((card) => card.key)).toEqual([
      'recognizedRevenue',
      'grossProfit',
      'netProfit',
      'revenue',
    ]);
  });

  it('card lợi nhuận gộp mang biên % ở caption, không phải kỳ báo cáo', () => {
    const card = toReportStatCards(report).find((c) => c.key === 'grossProfit');

    expect(card?.caption).toContain('75.6%');
  });

  it('card dòng tiền đổi nhãn thành "Cash collected"', () => {
    // Cùng con số như trước, tên đúng hơn khi đã có hai cách đọc cạnh nhau.
    const card = toReportStatCards(report).find((c) => c.key === 'revenue');

    expect(card?.label).toBe('Cash collected');
  });

  it('tám hàng P&L, đúng thứ tự người đọc dò một tờ báo cáo', () => {
    expect(toReportPnlRows(report).map((row) => row.key)).toEqual([
      'recognizedRevenue',
      'cogsVariable',
      'cogsFixed',
      'cogsTotal',
      'grossProfit',
      'taxAmount',
      'paymentFees',
      'netProfit',
    ]);
  });

  it('nhãn dòng thuế mang CHÍNH thuế suất của báo cáo đang đọc', () => {
    // Env không có ngày hiệu lực, nên tờ báo cáo phải tự khai nó được tính
    // bằng mức nào (ADR-0033 §5) — nếu không, hai lần đọc cùng một tháng ra
    // hai con số mà không ai biết vì sao.
    const rows = toReportPnlRows({ ...report, taxRate: 0.2 });

    expect(rows.find((row) => row.key === 'taxAmount')?.label).toContain('20.0%');
  });

  it('tháng LỖ in số âm, không nuốt dấu trừ', () => {
    const rows = toReportPnlRows({ ...report, grossProfit: '-150.00', netProfit: '-186.36' });

    expect(rows.find((row) => row.key === 'grossProfit')?.value).toContain('-');
    expect(rows.find((row) => row.key === 'netProfit')?.value).toContain('-');
  });

  it('cảnh báo thiếu giá vốn CHỈ hiện khi thật sự thiếu', () => {
    // In "Lợi nhuận gộp $8,400" trong khi 12 booking chưa khai giá vốn là một
    // báo cáo nói dối; in kèm con số thì nó chỉ là chưa đầy đủ.
    expect(costWarning({ ...report, costDataMissing: 0 })).toBeNull();
    expect(costWarning({ ...report, costDataMissing: 3 })).toContain('3');
  });
});
