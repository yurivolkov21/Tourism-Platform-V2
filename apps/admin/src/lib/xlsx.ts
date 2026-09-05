import type { AdminMonthlyReport, Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { formatDateTime, statusLabel } from './bookings-view';
import { formatMarginPct, reportPeriodLabel } from './reports-view';

/**
 * Dựng file Excel của báo cáo tháng (ADR-0034) — THUẦN: nhận dữ liệu, trả
 * `Buffer`. Không đọc cookie, không fetch, không đụng Next — nên mọi ô test
 * được bằng cách mở lại chính buffer vừa dựng.
 *
 * ## Vì sao Excel chứ không CSV
 *
 * Lý do KHÔNG phải cái đuôi file. Ô CSV chỉ mang được văn bản, nên
 * `reportCsvRows` phải **hy sinh cách trình bày để cứu tính toán** — JSDoc của
 * chính nó thú nhận: *"Excel đọc '$1,240.50' thành text và mọi phép SUM chết"*,
 * nên file cũ xuất `1240.50` trần. Ở đây số ghi xuống là `number` kèm
 * `numFmt`, nên file vừa ĐỌC như tiền vừa SUM được. Không phải chọn một.
 *
 * ## Năm sheet, mỗi sheet một câu hỏi
 *
 * | Sheet | Trả lời |
 * | --- | --- |
 * | Summary | Tháng này thu bao nhiêu, và lãi bao nhiêu |
 * | Bookings | Lứa booking tạo trong tháng giờ ra sao |
 * | Operations | Vận hành đã xử bao nhiêu việc |
 * | Detail | Từng booking một, để cộng tay kiểm chéo |
 * | Definitions | Cách đọc mấy con số trên — file đi xa hơn giấy |
 */

/** Âm trong ngoặc — quy ước báo cáo tài chính, không phải dấu trừ. */
const MONEY_FMT = '#,##0.00;(#,##0.00)';
const PCT_FMT = '0.0%';
const COUNT_FMT = '#,##0';
const DATE_FMT = 'dd mmm yyyy';

const t = messages.admin.reports;
const x = t.xlsx;

/** Viền trên mảnh — dấu hiệu "dòng này là tổng của mấy dòng trên". */
const TOP_RULE = { top: { style: 'thin' as const } };

/**
 * Chỗ `Number()` DUY NHẤT được phép cho tiền trong dự án (CLAUDE.md: tiền
 * không bao giờ đi qua float).
 *
 * Excel không có kiểu decimal — giá trị PHẢI xuống `number` để `numFmt` và
 * phép SUM hoạt động. Chỗ này nằm SAU mọi phép cộng: server đã cộng bằng
 * `Prisma.Decimal` và gửi xuống dạng chuỗi, tầng này chỉ ghi ra ô.
 */
function money(cell: ExcelJS.Cell, decimalString: string): void {
  cell.value = Number(decimalString);
  cell.numFmt = MONEY_FMT;
}

function count(cell: ExcelJS.Cell, value: number): void {
  cell.value = value;
  cell.numFmt = COUNT_FMT;
}

/** Một dòng nhãn · giá trị; `indent` cho dòng là THÀNH PHẦN của phép trừ trên nó. */
function labelRow(
  sheet: ExcelJS.Worksheet,
  label: string,
  opts: { indent?: boolean; total?: boolean } = {},
): ExcelJS.Row {
  const row = sheet.addRow([label]);
  if (opts.indent) row.getCell(1).alignment = { indent: 1 };
  if (opts.total) {
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true };
    row.getCell(2).border = TOP_RULE;
  }
  return row;
}

/**
 * Khối đầu Summary: file rời khỏi màn hình rồi vẫn phải tự nói nó là báo cáo
 * tháng nào, chốt lúc nào, và — quan trọng nhất — tính bằng THUẾ SUẤT nào.
 *
 * Thuế suất ở đây không phải trang trí: env không có ngày hiệu lực, nên hai
 * file tải cùng một tháng ở hai thời điểm có thể mang hai số thuế khác nhau
 * (ADR-0033 §5). Không in suất thì không ai đối chiếu được.
 */
function writeHeader(sheet: ExcelJS.Worksheet, report: AdminMonthlyReport): void {
  sheet.mergeCells('A1:B1');
  const title = sheet.getCell('A1');
  title.value = x.title;
  title.font = { size: 14, bold: true };

  for (const [label, value, fmt] of [
    [x.period, reportPeriodLabel(report)],
    [x.generatedAt, formatDateTime(report.generatedAt)],
    [x.currency, report.currency],
    [x.taxRate, report.taxRate, PCT_FMT],
  ] as Array<[string, string | number, string?]>) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (fmt) row.getCell(2).numFmt = fmt;
  }
  sheet.addRow([]);
}

/** Tiêu đề một khối trong Summary. */
function sectionRow(sheet: ExcelJS.Worksheet, label: string): void {
  const row = sheet.addRow([label]);
  row.getCell(1).font = { bold: true, size: 12 };
}

function buildSummary(book: ExcelJS.Workbook, report: AdminMonthlyReport): void {
  const sheet = book.addWorksheet(x.sheets.summary);
  sheet.getColumn(1).width = 38;
  sheet.getColumn(2).width = 18;

  writeHeader(sheet, report);

  // Khối 1 — DÒNG TIỀN (neo ngày trả tiền). Đứng trước vì nó là cách đọc cũ,
  // và người quen tờ báo cáo trước sẽ tìm nó đầu tiên.
  sectionRow(sheet, x.cashHeading);
  money(labelRow(sheet, t.operationsTable.revenue).getCell(2), report.revenue);
  money(labelRow(sheet, t.operationsTable.refundedTotal).getCell(2), report.refundedTotal);
  sheet.addRow([]);

  // Khối 2 — KẾT QUẢ KINH DOANH (neo ngày chuyến chạy).
  sectionRow(sheet, t.pnlTable.heading);
  const p = t.pnlTable;
  money(labelRow(sheet, p.recognizedRevenue).getCell(2), report.recognizedRevenue);
  money(labelRow(sheet, p.cogsVariable, { indent: true }).getCell(2), report.cogsVariable);
  money(labelRow(sheet, p.cogsFixed, { indent: true }).getCell(2), report.cogsFixed);
  money(labelRow(sheet, p.cogsTotal, { total: true }).getCell(2), report.cogsTotal);
  money(labelRow(sheet, p.grossProfit, { total: true }).getCell(2), report.grossProfit);

  // Biên gộp là TỈ LỆ, và `null` phải ra chữ chứ không ra 0 — một tháng không
  // có chuyến nào chạy có biên KHÔNG XÁC ĐỊNH (ADR-0033 §1).
  const marginCell = labelRow(sheet, x.grossMargin).getCell(2);
  if (report.grossMarginPct === null) {
    marginCell.value = p.marginUnknown;
  } else {
    marginCell.value = report.grossMarginPct;
    marginCell.numFmt = PCT_FMT;
  }

  money(
    labelRow(sheet, p.taxAmount(formatMarginPct(report.taxRate)), { indent: true }).getCell(2),
    report.taxAmount,
  );
  money(labelRow(sheet, p.paymentFees, { indent: true }).getCell(2), report.paymentFees);
  money(labelRow(sheet, p.netProfit, { total: true }).getCell(2), report.netProfit);
  sheet.addRow([]);

  count(labelRow(sheet, x.departuresRun).getCell(2), report.departuresRun);
  count(labelRow(sheet, x.costDataMissing).getCell(2), report.costDataMissing);

  sheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function buildBookings(book: ExcelJS.Workbook, report: AdminMonthlyReport): void {
  const sheet = book.addWorksheet(x.sheets.bookings);
  sheet.columns = [
    { header: t.bookingsTable.status, key: 'status', width: 26 },
    { header: t.bookingsTable.count, key: 'count', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of report.bookingsByStatus) {
    const added = sheet.addRow([statusLabel(row.status)]);
    count(added.getCell(2), row.count);
  }
  const total = sheet.addRow([t.bookingsTable.total]);
  total.getCell(1).font = { bold: true };
  count(total.getCell(2), report.newBookings);
  total.getCell(2).font = { bold: true };
  total.getCell(2).border = TOP_RULE;

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };
}

function buildOperations(book: ExcelJS.Workbook, report: AdminMonthlyReport): void {
  const sheet = book.addWorksheet(x.sheets.operations);
  sheet.columns = [
    { header: t.operationsTable.metric, key: 'metric', width: 34 },
    { header: t.operationsTable.value, key: 'value', width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  const o = t.operationsTable;
  money(sheet.addRow([o.refundedTotal]).getCell(2), report.refundedTotal);
  count(sheet.addRow([o.refunds]).getCell(2), report.refunds);
  count(sheet.addRow([o.paidBookings]).getCell(2), report.paidBookings);
  count(sheet.addRow([o.newBookings]).getCell(2), report.newBookings);
  count(sheet.addRow([o.cancellationsApproved]).getCell(2), report.cancellationsApproved);
  count(sheet.addRow([o.cancellationsDenied]).getCell(2), report.cancellationsDenied);
  count(sheet.addRow([o.reviewsApproved]).getCell(2), report.reviewsApproved);

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };
}

/**
 * Từng booking một — thứ khiến báo cáo KIỂM CHÉO được thay vì phải tin.
 *
 * ⚠️ Tập này là booking **TẠO trong tháng**, cùng tập với sheet *Bookings* ở
 * trên (`admin.bookings.list` lọc theo `created_at` — ADR-0028 chốt giữ cột
 * ấy). Nó **KHÔNG** phải tập của khối P&L, vốn neo ngày chuyến KẾT THÚC. Hai
 * tập khác nhau, và tiêu đề sheet nói thẳng điều đó — người đọc thử cộng cột
 * `Total` để ra `Revenue recognised` sẽ không bao giờ khớp, nên phải chặn hiểu
 * nhầm ấy ngay trên file.
 */
function buildDetail(book: ExcelJS.Workbook, bookings: readonly Booking[]): void {
  const sheet = book.addWorksheet(x.sheets.detail);
  sheet.columns = [
    { header: x.detail.code, key: 'code', width: 16 },
    { header: x.detail.tour, key: 'tour', width: 38 },
    { header: x.detail.departureEnds, key: 'ends', width: 16 },
    { header: x.detail.travellers, key: 'pax', width: 12 },
    { header: x.detail.total, key: 'total', width: 14 },
    { header: x.detail.refunded, key: 'refunded', width: 14 },
    { header: x.detail.status, key: 'status', width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const booking of bookings) {
    const row = sheet.addRow([booking.code, booking.tourTitle]);
    const ends = row.getCell(3);
    // Ô NGÀY thật, không phải chuỗi: người đọc lọc và sắp xếp được theo nó.
    ends.value = new Date(booking.departureEndDate);
    ends.numFmt = DATE_FMT;
    count(row.getCell(4), booking.numAdults + booking.numChildren);
    money(row.getCell(5), booking.totalAmount);
    money(row.getCell(6), booking.refundedTotal);
    row.getCell(7).value = statusLabel(booking.status);
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  // Bộ lọc trên hàng tiêu đề — thứ biến sheet này thành công cụ kiểm chéo
  // thay vì một danh sách để nhìn.
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: sheet.columnCount } };
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    orientation: 'landscape',
    printTitlesRow: '1:1',
  };
}

/**
 * Khối "cách đọc mấy con số này" — đi kèm MỌI bản xuất.
 *
 * Cùng lý do nó đi kèm mọi bản in (`page.tsx`): khi báo cáo rời khỏi màn hình
 * thì không còn tooltip nào để hỏi. File Excel rời đi xa hơn giấy — nó được
 * gửi qua email, mở trên máy người khác, đọc lại sau sáu tháng.
 */
function buildDefinitions(book: ExcelJS.Workbook): void {
  const sheet = book.addWorksheet(x.sheets.definitions);
  sheet.getColumn(1).width = 110;

  const heading = sheet.addRow([t.definitions.heading]);
  heading.font = { bold: true, size: 12 };
  sheet.addRow([]);

  for (const line of [
    t.definitions.revenue,
    t.definitions.recognised,
    t.definitions.costs,
    t.definitions.netProfit,
    t.definitions.refunds,
    t.definitions.statuses,
  ]) {
    const row = sheet.addRow([line]);
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    row.height = 30;
  }
}

/**
 * Toàn bộ workbook. `bookings` là tập cho sheet *Detail*; truyền mảng rỗng thì
 * sheet vẫn có mặt với đúng hàng tiêu đề — một sheet BIẾN MẤT khi tháng vắng
 * sẽ làm hai file cùng tháng trông khác cấu trúc.
 */
export async function buildReportWorkbook(
  report: AdminMonthlyReport,
  bookings: readonly Booking[],
): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  book.created = new Date(report.generatedAt);

  buildSummary(book, report);
  buildBookings(book, report);
  buildOperations(book, report);
  buildDetail(book, bookings);
  buildDefinitions(book);

  // ExcelJS khai kiểu trả về là `Buffer` của RIÊNG nó
  // (`interface Buffer extends ArrayBuffer {}`), không phải `Buffer` của Node —
  // ép sang kiểu Node là typecheck đỏ. `ArrayBuffer` là thứ nó thật sự trả, và
  // cũng là thứ `Response` nhận thẳng làm body.
  return (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
