import type { AdminMonthlyReport } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildReportWorkbook } from './xlsx';
import { COST, GAIN, MONEY_FMT, PAPER, PCT_FMT } from './xlsx-style';

/**
 * Summary dạng dashboard (bản thảo D1, spec G40 §6.2) và khung workbook. Mở LẠI chính buffer — thứ
 * người dùng nhận là file. Điều đáng canh nhất vẫn là KIỂU ô: tiền là số kèm định dạng, tỉ lệ là số
 * kèm %, thanh là công thức tham chiếu đúng ô.
 */
const t = messages.admin.reports;

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
  cancellationsWithinDeadline: 1,
  cancellationsAfterDeadline: 3,
  reviewsApproved: 5,
  recognizedThrough: '2026-09-30',
  recognizedRevenue: '2500.00',
  cogsVariable: '210.00',
  cogsFixed: '400.00',
  cogsTotal: '610.00',
  grossProfit: '1890.00',
  grossMarginPct: 0.756,
  taxRate: 0.1,
  taxAmount: '171.82',
  paymentFees: '30.20',
  netProfit: '1687.98',
  departuresRun: 1,
  costDataMissing: 1,
  departuresCostMissing: 0,
};

async function open(report_: AdminMonthlyReport): Promise<ExcelJS.Workbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await buildReportWorkbook(report_, [], { adminOrigin: 'https://admin.example.com' }),
  );
  return book;
}

async function summaryOf(report_: AdminMonthlyReport): Promise<ExcelJS.Worksheet> {
  const sheet = (await open(report_)).getWorksheet(t.xlsx.sheets.summary);
  if (!sheet) throw new Error('Không có sheet Summary');
  return sheet;
}

/** Hàng có nhãn ấy ở cột B (thác nước, trạng thái, vận hành). */
function rowLabelled(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (row.getCell(2).value === label) found = row;
  });
  if (!found) throw new Error(`Không có hàng "${label}" ở cột B`);
  return found;
}

describe('workbook báo cáo — metadata (spec §6.1)', () => {
  it('creator, tiêu đề, chủ đề, công ty, giờ tạo', async () => {
    const book = await open(report);
    expect(book.creator).toBe(messages.admin.exportFile.backOffice);
    expect(book.lastModifiedBy).toBe(messages.admin.exportFile.backOffice);
    expect(book.title).toBe(t.xlsx.docTitle('2026-09'));
    expect(book.subject).toBe(t.xlsx.subject('September 2026'));
    expect(book.company).toBe(messages.admin.exportFile.company);
    expect(book.created?.toISOString()).toBe(report.generatedAt);
  });
});

describe('Summary D1', () => {
  it('tab màu thương hiệu, ẩn lưới, đầu trang nói tên báo cáo', async () => {
    const sheet = await summaryOf(report);
    expect(sheet.properties.tabColor).toEqual({ argb: 'FF2E6E66' });
    expect(sheet.views[0]?.showGridLines).toBe(false);
    expect(sheet.headerFooter.oddHeader).toContain(t.xlsx.headerCenter('September 2026'));
  });

  it('tiêu đề và dòng kỳ — kỳ, đơn vị tiền, thuế suất', async () => {
    const sheet = await summaryOf(report);
    expect(sheet.getCell('B2').value).toBe(t.reportTitle('September 2026'));
    expect(sheet.getCell('B3').value).toBe(
      t.periodLine('1 Sep 2026 – 30 Sep 2026', 'USD', '10.0%'),
    );
  });

  it('tháng đang chạy: dòng kỳ nói "(to date)" như màn hình (ADR-0033 AMEND 3)', async () => {
    const sheet = await summaryOf({
      ...report,
      month: '2026-10',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      recognizedThrough: '2026-10-15',
    });
    expect(sheet.getCell('B3').value).toBe(
      t.periodLine(t.periodToDate('1 Oct 2026', '15 Oct 2026'), 'USD', '10.0%'),
    );
  });

  it('bốn ô số: nhãn mono viết hoa, số là SỐ có ký hiệu $, dòng phụ; ô đầu nền giấy', async () => {
    const sheet = await summaryOf(report);
    expect(sheet.getCell('B5').value).toBe(t.cards.recognizedRevenue.toUpperCase());
    expect(sheet.getCell('B6').value).toBe(2500);
    expect(sheet.getCell('B6').numFmt).toBe('"$"#,##0.00;("$"#,##0.00)');
    expect(sheet.getCell('B7').value).toBe(t.cards.recognizedCaption);
    expect(sheet.getCell('B6').fill).toMatchObject({ fgColor: { argb: PAPER } });
    expect(sheet.getCell('D7').value).toBe(t.cards.marginCaption('75.6%'));
    expect(sheet.getCell('F6').value).toBe(1687.98);
    expect(sheet.getCell('H6').value).toBe(1240.5);
    expect(sheet.getCell('H7').value).toBe(t.cards.paidCaption('8'));
  });

  it('biên KHÔNG XÁC ĐỊNH ra dấu gạch, không ra 0%', async () => {
    const sheet = await summaryOf({ ...report, grossMarginPct: null });
    expect(sheet.getCell('D7').value).toBe(t.cards.marginCaption(t.pnlTable.marginUnknown));
  });

  it('đơn vị khác USD: ô số dùng định dạng tiền thường', async () => {
    const sheet = await summaryOf({ ...report, currency: 'EUR' });
    expect(sheet.getCell('B6').numFmt).toBe(MONEY_FMT);
  });

  it('thác nước: bảy dòng đúng thứ tự, chi phí là số ÂM, tổng phụ không thụt', async () => {
    const sheet = await summaryOf(report);
    const p = t.pnlTable;
    const labels = [
      p.recognizedRevenue,
      p.cogsVariable,
      p.cogsFixed,
      p.grossProfit,
      p.taxAmount('10.0%'),
      p.paymentFees,
      p.netProfit,
    ];
    labels.forEach((label, index) => {
      expect(sheet.getCell(`B${11 + index}`).value, label).toBe(label);
    });
    expect(sheet.getCell('E11').value).toBe(2500);
    expect(sheet.getCell('E12').value).toBe(-210);
    expect(sheet.getCell('E12').numFmt).toBe(MONEY_FMT);
    expect(sheet.getCell('B12').alignment?.indent).toBe(2);
    expect(sheet.getCell('B14').alignment?.indent ?? 0).toBe(0);
    expect(sheet.getCell('E17').value).toBe(1687.98);
  });

  it('thanh REPT tham chiếu dòng doanh thu, có chốt chia 0; màu theo dòng', async () => {
    const sheet = await summaryOf(report);
    const bar = sheet.getCell('F12').value as ExcelJS.CellFormulaValue;
    expect(bar.formula).toBe('IF($E$11=0,"",REPT("█",MAX(1,ROUND(ABS(E12)/$E$11*30,0))))');
    expect(bar.result).toBe('█'.repeat(3)); // 210 / 2500 × 30 = 2,52 → 3
    expect(sheet.getCell('F11').font?.color?.argb).toBe(GAIN);
    expect(sheet.getCell('F12').font?.color?.argb).toBe(COST);
  });

  it('tháng LỖ: lãi ròng là số âm và thanh đổi sang màu chi phí', async () => {
    const sheet = await summaryOf({ ...report, grossProfit: '-150.00', netProfit: '-186.36' });
    expect(sheet.getCell('E17').value).toBe(-186.36);
    expect(sheet.getCell('F17').font?.color?.argb).toBe(COST);
  });

  it('chưa có doanh thu: thanh để trống chứ không #DIV/0!', async () => {
    const sheet = await summaryOf({ ...report, recognizedRevenue: '0.00' });
    // File ghi `t="str"` kèm `<v></v>` (giá trị đệm là chuỗi rỗng), nhưng trình ĐỌC của ExcelJS
    // 4.4.0 bỏ qua `<v>` rỗng nên `result` đọc lại là undefined — `?? ''` chỉ bù chỗ ấy.
    expect((sheet.getCell('F11').value as ExcelJS.CellFormulaValue).result ?? '').toBe('');
  });

  it('dưới bảng: số chuyến đã chạy, rồi cảnh báo thiếu giá vốn khi có', async () => {
    const sheet = await summaryOf(report);
    expect(sheet.getCell('B18').value).toBe(t.pnlTable.departuresRun('1'));
    expect(sheet.getCell('B19').value).toBe(t.pnlTable.costMissing('1'));
    expect(sheet.getCell('B19').font?.color?.argb).toBe(COST);
  });

  it('trạng thái: số, Share là công thức %, thanh, Total là SUM khớp newBookings', async () => {
    const sheet = await summaryOf(report);
    const paid = rowLabelled(sheet, messages.admin.bookings.status.PAID);
    expect(paid.getCell(3).value).toBe(6);
    const share = paid.getCell(4).value as ExcelJS.CellFormulaValue;
    expect(share.formula).toMatch(/^IF\(\$C\$\d+=0,0,C\d+\/\$C\$\d+\)$/);
    expect(share.result).toBeCloseTo(6 / 11, 6);
    expect(paid.getCell(4).numFmt).toBe(PCT_FMT);
    expect(paid.getCell(5).font?.color?.argb).toBe(GAIN);
    const total = rowLabelled(sheet, t.bookingsTable.total);
    expect((total.getCell(3).value as ExcelJS.CellFormulaValue).result).toBe(11);
  });

  it('trạng thái có 0 đơn: thanh trống, không một ký tự giả', async () => {
    const sheet = await summaryOf({
      ...report,
      bookingsByStatus: report.bookingsByStatus.map((row) =>
        row.status === 'REFUNDED' ? { ...row, count: 0 } : row,
      ),
    });
    const refunded = rowLabelled(sheet, messages.admin.bookings.status.REFUNDED);
    // `?? ''`: ExcelJS bỏ `<v>` rỗng khi đọc lại (xem ca "chưa có doanh thu").
    expect((refunded.getCell(5).value as ExcelJS.CellFormulaValue).result ?? '').toBe('');
  });

  it('Money and operations: tám chỉ số hai cột, là Ô SỐ; dòng cuối chỉ sang Definitions', async () => {
    const sheet = await summaryOf(report);
    const o = t.operationsTable;
    const revenue = rowLabelled(sheet, o.revenue);
    expect(revenue.getCell(5).value).toBe(1240.5);
    let rightLabel: ExcelJS.CellValue = null;
    sheet.eachRow((row) => {
      if (row.getCell(6).value === o.cancellationsAfterDeadline) rightLabel = row.getCell(9).value;
    });
    expect(rightLabel).toBe(3);
    let footnote = false;
    sheet.eachRow((row) => {
      if (row.getCell(2).value === t.xlsx.seeDefinitions) footnote = true;
    });
    expect(footnote).toBe(true);
  });
});
