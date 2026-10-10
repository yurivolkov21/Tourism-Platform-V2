import type { AdminMonthlyReport, Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildReportWorkbook } from './xlsx';
import { BAND, BRAND, COST, DATE_FMT, DIM, MONEY_FMT, RULE } from './xlsx-style';

/**
 * File Excel của báo cáo tháng (ADR-0034, D1 theo AMEND 3): bốn sheet sau Summary và khung chung.
 * Mở LẠI chính buffer — thứ người dùng nhận là file.
 */
const t = messages.admin.reports;
const x = t.xlsx;
const ORIGIN = 'https://admin.example.com';

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

const paid = {
  code: 'BK-ABCD1234',
  tourTitle: 'Hội An Lantern Evening',
  departureEndDate: '2026-09-20',
  numAdults: 2,
  numChildren: 1,
  totalAmount: '900.00',
  refundedTotal: '100.00',
  status: 'PAID',
} as unknown as Booking;

const cancelled = {
  ...paid,
  code: 'BK-WXYZ5678',
  numAdults: 1,
  numChildren: 0,
  totalAmount: '0.10',
  refundedTotal: '0.20',
  status: 'CANCELLED',
} as unknown as Booking;

async function open(bookings: Booking[] = [paid, cancelled], detailNote?: string) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await buildReportWorkbook(report, bookings, { detailNote, adminOrigin: ORIGIN }),
  );
  return book;
}

function sheetNamed(book: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = book.getWorksheet(name);
  if (!sheet) {
    throw new Error(
      `Không có sheet "${name}" — đang có: ${book.worksheets.map((s) => s.name).join(', ')}`,
    );
  }
  return sheet;
}

/** Ô cột B của hàng có nhãn ấy ở cột A. */
function valueFor(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Cell | undefined {
  let found: ExcelJS.Cell | undefined;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === label) found = row.getCell(2);
  });
  return found;
}

describe('buildReportWorkbook — cấu trúc', () => {
  it('đủ năm sheet, đúng thứ tự đọc', async () => {
    expect((await open()).worksheets.map((sheet) => sheet.name)).toEqual([
      x.sheets.summary,
      x.sheets.bookings,
      x.sheets.operations,
      x.sheets.detail,
      x.sheets.definitions,
    ]);
  });

  it('mọi sheet: A4, vừa một trang ngang, căn giữa, đầu và chân trang khi in', async () => {
    for (const sheet of (await open()).worksheets) {
      expect(sheet.pageSetup.paperSize, sheet.name).toBe(9);
      expect(sheet.pageSetup.fitToWidth, sheet.name).toBe(1);
      expect(sheet.pageSetup.horizontalCentered, sheet.name).toBe(true);
      expect(sheet.headerFooter.oddHeader, sheet.name).toContain(x.headerCenter('September 2026'));
      expect(sheet.headerFooter.oddFooter, sheet.name).toContain(
        messages.admin.exportFile.generated('30 Sep 2026, 12:00 UTC'),
      );
    }
  });

  it('tab: Summary thương hiệu, Definitions xám nhạt, còn lại xám; lưới chỉ ở sheet dữ liệu', async () => {
    const book = await open();
    expect(sheetNamed(book, x.sheets.summary).properties.tabColor).toEqual({ argb: BRAND });
    expect(sheetNamed(book, x.sheets.definitions).properties.tabColor).toEqual({ argb: RULE });
    expect(sheetNamed(book, x.sheets.detail).properties.tabColor).toEqual({ argb: DIM });
    expect(sheetNamed(book, x.sheets.definitions).views[0]?.showGridLines).toBe(false);
    expect(sheetNamed(book, x.sheets.detail).views[0]?.showGridLines).toBe(true);
  });

  it('tháng VẮNG vẫn đủ năm sheet — cấu trúc không đổi theo dữ liệu', async () => {
    const book = await open([]);
    const detail = sheetNamed(book, x.sheets.detail);
    expect(book.worksheets).toHaveLength(5);
    expect(detail.getCell('A1').value).toBe(x.detail.code);
    expect(detail.getCell('A2').value).toBeNull();
  });
});

describe('sheet Bookings và Operations', () => {
  it('Bookings: tiêu đề nền thương hiệu chữ trắng; Share là %, Total là SUM khớp newBookings', async () => {
    const sheet = sheetNamed(await open(), x.sheets.bookings);
    expect(sheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: BRAND } });
    expect(sheet.getCell('A1').font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    expect(sheet.getCell('C1').value).toBe(x.share);
    const total = valueFor(sheet, t.bookingsTable.total)?.value as
      | ExcelJS.CellFormulaValue
      | undefined;
    expect(total?.result).toBe(11);
    expect(sheet.views[0]?.state).toBe('frozen');
  });

  it('Operations: tám chỉ số, là Ô SỐ, hai loại huỷ theo hạn chót (ADR-0041 §9)', async () => {
    const sheet = sheetNamed(await open(), x.sheets.operations);
    expect(valueFor(sheet, t.operationsTable.revenue)?.value).toBe(1240.5);
    expect(valueFor(sheet, t.operationsTable.cancellationsWithinDeadline)?.value).toBe(1);
    expect(valueFor(sheet, t.operationsTable.cancellationsAfterDeadline)?.value).toBe(3);
    expect(sheet.rowCount).toBe(9);
  });
});

describe('sheet Detail (created this month)', () => {
  it('mã đơn là hyperlink tới trang đơn admin; ngày là Ô NGÀY ép tiếng Anh; tiền là số', async () => {
    const sheet = sheetNamed(await open(), x.sheets.detail);
    expect(sheet.getCell('A2').value).toEqual({
      text: 'BK-ABCD1234',
      hyperlink: `${ORIGIN}/bookings/BK-ABCD1234`,
    });
    expect(sheet.getCell('C2').value).toBeInstanceOf(Date);
    expect(sheet.getCell('C2').numFmt).toBe(DATE_FMT);
    expect(sheet.getCell('D2').value).toBe(3);
    expect(sheet.getCell('E2').value).toBe(900);
    expect(sheet.getCell('E2').numFmt).toBe(MONEY_FMT);
    expect(sheet.getCell('G2').value).toBe(messages.admin.bookings.status.PAID);
  });

  it('"Cancelled" chữ màu chi phí; hàng chẵn có sọc', async () => {
    const sheet = sheetNamed(await open(), x.sheets.detail);
    expect(sheet.getCell('G3').font?.color?.argb).toBe(COST);
    expect(sheet.getCell('B3').fill).toMatchObject({ fgColor: { argb: BAND } });
  });

  it('hàng Total dùng SUBTOTAL(109) và cộng tiền theo xu', async () => {
    const sheet = sheetNamed(await open(), x.sheets.detail);
    expect(sheet.getCell('A4').value).toBe(t.bookingsTable.total);
    expect(sheet.getCell('D4').value).toEqual({ formula: 'SUBTOTAL(109,D2:D3)', result: 4 });
    expect(sheet.getCell('E4').value).toEqual({ formula: 'SUBTOTAL(109,E2:E3)', result: 900.1 });
    expect(sheet.getCell('F4').value).toEqual({ formula: 'SUBTOTAL(109,F2:F3)', result: 100.2 });
  });

  it('vùng lọc tới hàng DỮ LIỆU cuối, không gồm hàng Total; đóng băng; khổ ngang; lặp tiêu đề', async () => {
    const sheet = sheetNamed(await open(), x.sheets.detail);
    expect(sheet.autoFilter).toBe('A1:G3');
    expect(sheet.views[0]?.state).toBe('frozen');
    expect(sheet.pageSetup.orientation).toBe('landscape');
    expect(sheet.pageSetup.printTitlesRow).toBe('1:1');
  });

  it('thiếu hàng (vượt trần): câu ghi chú ngay dưới tiêu đề, không hàng Total', async () => {
    const note = x.detail.omittedTooLarge(2000);
    const sheet = sheetNamed(await open([], note), x.sheets.detail);
    expect(sheet.getCell('A2').value).toBe(note);
    expect(sheet.getCell('A3').value).toBeNull();
  });

  it('lệch số: câu ghi chú nằm DƯỚI hàng Total, ngoài vùng lọc (quyết định 8)', async () => {
    const note = x.detail.countMismatch(2, 11);
    const sheet = sheetNamed(await open([paid, cancelled], note), x.sheets.detail);
    expect(sheet.getCell('A4').value).toBe(t.bookingsTable.total);
    expect(sheet.getCell('A6').value).toBe(note);
    expect(sheet.autoFilter).toBe('A1:G3');
  });
});

describe('sheet Definitions', () => {
  it('tiêu đề và bảy chú giải đánh số 1–7, chữ xuống dòng', async () => {
    const sheet = sheetNamed(await open(), x.sheets.definitions);
    expect(sheet.getCell('B2').value).toBe(t.definitions.heading);
    const lines = [
      t.definitions.revenue,
      t.definitions.recognised,
      t.definitions.costs,
      t.definitions.netProfit,
      t.definitions.refunds,
      t.definitions.statuses,
      t.definitions.cancellations,
    ];
    lines.forEach((line, index) => {
      expect(sheet.getCell(`B${4 + index}`).value).toBe(index + 1);
      expect(sheet.getCell(`C${4 + index}`).value).toBe(line);
      expect(sheet.getCell(`C${4 + index}`).alignment?.wrapText).toBe(true);
    });
  });
});
