import type { AdminMonthlyReport, Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildReportWorkbook } from './xlsx';

/**
 * File Excel của báo cáo tháng (ADR-0034).
 *
 * Bộ này mở LẠI chính buffer vừa dựng chứ không soi cấu trúc trong bộ nhớ —
 * thứ người dùng nhận là file, nên thứ đáng kiểm cũng phải là file.
 *
 * Điều đáng canh nhất KHÔNG phải bố cục mà là **kiểu ô**: cả lý do đổi từ CSV
 * sang Excel nằm ở chỗ tiền phải là `number` kèm `numFmt`, chứ không phải một
 * chuỗi trông giống tiền. Một hồi quy ở đó biến file trở lại đúng thứ CSV vốn
 * đã làm được, và không ai nhận ra cho tới khi thử SUM.
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

const booking = {
  code: 'BK-ABCD1234',
  tourTitle: 'Hội An Lantern Evening',
  departureEndDate: '2026-09-20',
  numAdults: 2,
  numChildren: 1,
  totalAmount: '900.00',
  refundedTotal: '100.00',
  status: 'PAID',
} as unknown as Booking;

async function open(report_: AdminMonthlyReport, bookings: Booking[] = [booking]) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await buildReportWorkbook(report_, bookings));
  return book;
}

/**
 * Lấy một sheet theo tên, hoặc NÉM kèm danh sách sheet đang có.
 *
 * Thay cho `!`: sheet đổi tên thì lỗi nói ngay tên nào có thật, chứ không phải
 * một `TypeError` trên `undefined` cách đó ba dòng.
 */
function sheetNamed(book: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = book.getWorksheet(name);
  if (!sheet) {
    throw new Error(
      `Không có sheet "${name}" — đang có: ${book.worksheets.map((s) => s.name).join(', ')}`,
    );
  }
  return sheet;
}

/** Ô giá trị (cột B) của dòng mang đúng nhãn ấy ở cột A. */
function cellFor(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Cell | undefined {
  let found: ExcelJS.Cell | undefined;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === label) found = row.getCell(2);
  });
  return found;
}

describe('buildReportWorkbook', () => {
  it('có đủ năm sheet, đúng thứ tự đọc', async () => {
    const book = await open(report);

    expect(book.worksheets.map((sheet) => sheet.name)).toEqual([
      'Summary',
      'Bookings',
      'Operations',
      'Detail (created this month)',
      'Definitions',
    ]);
  });

  it('sheet Bookings có dòng Total khớp `newBookings` của server', async () => {
    const book = await open(report);
    const cell = cellFor(sheetNamed(book, 'Bookings'), t.bookingsTable.total);

    expect(cell?.value).toBe(11);
  });

  it('sheet Operations đếm hai loại huỷ theo hạn chót (ADR-0041 §9), là Ô SỐ', async () => {
    const sheet = sheetNamed(await open(report), 'Operations');

    expect(cellFor(sheet, t.operationsTable.cancellationsWithinDeadline)?.value).toBe(1);
    expect(cellFor(sheet, t.operationsTable.cancellationsAfterDeadline)?.value).toBe(3);
  });

  it('sheet Detail ghi ngày là Ô NGÀY thật, để lọc và sắp xếp được', async () => {
    const book = await open(report);
    const row = sheetNamed(book, 'Detail (created this month)').getRow(2);

    expect(row.getCell(1).value).toBe('BK-ABCD1234');
    expect(row.getCell(3).value).toBeInstanceOf(Date);
    expect(row.getCell(4).value).toBe(3); // 2 người lớn + 1 trẻ em
    expect(row.getCell(5).value).toBe(900);
  });

  it('sheet Detail có autofilter và hàng tiêu đề đóng băng', async () => {
    // Hai thứ này biến sheet thành công cụ kiểm chéo thay vì một danh sách
    // để nhìn — bỏ chúng đi là bỏ lý do sheet tồn tại.
    const sheet = sheetNamed(await open(report), 'Detail (created this month)');

    // Vùng lọc phải phủ TỚI hàng dữ liệu cuối: `ref` chỉ `A1:G1` thì LibreOffice
    // và Google Sheets lọc trên đúng một hàng (vòng vá review 05/09).
    // Đọc lại từ file, ExcelJS trả `ref` dạng chuỗi 'A1:G<n>'.
    expect(sheet.rowCount).toBeGreaterThan(1);
    expect(sheet.autoFilter).toBe(`A1:G${sheet.rowCount}`);
    expect(sheet.views[0]?.state).toBe('frozen');
  });

  it('tháng VẮNG vẫn đủ năm sheet — cấu trúc không đổi theo dữ liệu', async () => {
    // Một sheet biến mất khi tháng vắng làm hai file cùng tháng trông khác
    // cấu trúc, và người ta sẽ tưởng file hỏng.
    const book = await open(report, []);
    const detail = sheetNamed(book, 'Detail (created this month)');

    expect(book.worksheets).toHaveLength(5);
    expect(detail.getRow(1).getCell(1).value).toBe(t.xlsx.detail.code);
  });

  it('sheet Definitions mang đủ bảy câu, kể cả ba câu của cột kinh doanh và câu về huỷ', async () => {
    const sheet = sheetNamed(await open(report), 'Definitions');
    const text = JSON.stringify(sheet.getSheetValues());

    for (const line of [
      t.definitions.revenue,
      t.definitions.recognised,
      t.definitions.costs,
      t.definitions.netProfit,
      t.definitions.refunds,
      t.definitions.statuses,
      t.definitions.cancellations,
    ]) {
      expect(text).toContain(line.slice(0, 40));
    }
  });
});

/**
 * Phần TRÌNH BÀY (user chốt 05/09: file phải là một bảng hoàn chỉnh — có màu,
 * canh lề, kẻ viền, phân khối rõ ràng).
 *
 * Bộ này canh những thứ mà mở file ra mới thấy thiếu, và không test nào khác
 * bắt được: một hồi quy ở đây cho ra một file ĐÚNG SỐ nhưng trông như dữ liệu
 * dán vào bảng tính — đúng thứ vòng này đi chữa.
 */
describe('trình bày', () => {
  it('hàng tiêu đề bảng có nền thương hiệu và chữ trắng', async () => {
    const cell = sheetNamed(await open(report), 'Bookings')
      .getRow(1)
      .getCell(1);

    expect(cell.fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FF2E6E66' } });
    expect(cell.font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
  });

  it('ô dữ liệu có viền bốn cạnh — mỗi ô là một ô, không phải chữ trôi trên nền', async () => {
    const cell = sheetNamed(await open(report), 'Bookings')
      .getRow(2)
      .getCell(1);

    expect(cell.border?.top).toBeTruthy();
    expect(cell.border?.left).toBeTruthy();
    expect(cell.border?.bottom).toBeTruthy();
    expect(cell.border?.right).toBeTruthy();
  });

  it('nhãn canh TRÁI, số canh PHẢI', async () => {
    const row = sheetNamed(await open(report), 'Bookings').getRow(2);

    expect(row.getCell(1).alignment?.horizontal).toBe('left');
    expect(row.getCell(2).alignment?.horizontal).toBe('right');
  });

  it('sheet Detail kẻ viền cả bảy cột, không chỉ hai cột đầu', async () => {
    const row = sheetNamed(await open(report), 'Detail (created this month)').getRow(2);

    for (let column = 1; column <= 7; column += 1) {
      expect(row.getCell(column).border?.bottom, `cột ${column}`).toBeTruthy();
    }
  });
});
