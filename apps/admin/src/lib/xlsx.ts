import type { AdminMonthlyReport, Booking, BookingStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { statusLabel } from './bookings-view';
import { formatMonthLabel } from './month-options';
import { costWarning, formatMarginPct, reportPeriodLabel } from './reports-view';
import { formatCount } from './stats-view';
import {
  addSheet,
  BAND,
  BRAND,
  BRAND_SOFT,
  bodyFont,
  COST,
  COUNT_FMT,
  count,
  DATE_FMT,
  DIM,
  fill,
  GAIN,
  HEAD_FONT,
  INK,
  MONEY_FMT,
  MONO_FONT,
  money,
  PAPER,
  PCT_FMT,
  printFrame,
  RULE,
  stampWorkbook,
  thin,
  WHITE,
} from './xlsx-style';

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

const t = messages.admin.reports;
const x = t.xlsx;

/** Viền mảnh bốn cạnh — mỗi ô dữ liệu là một ô, không phải chữ trôi trên nền. */
const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' as const, color: { argb: RULE } },
  left: { style: 'thin' as const, color: { argb: RULE } },
  bottom: { style: 'thin' as const, color: { argb: RULE } },
  right: { style: 'thin' as const, color: { argb: RULE } },
};

/** Viền trên ĐẬM — dấu hiệu "dòng này là tổng của mấy dòng trên". */
const TOP_RULE: Partial<ExcelJS.Borders> = {
  ...CELL_BORDER,
  top: { style: 'medium', color: { argb: BRAND } },
};

/** Kẻ viền + canh lề cho một dải ô của một dòng. */
function dressRow(
  row: ExcelJS.Row,
  columns: number,
  // `Partial<Borders>` của ExcelJS chứ không `typeof CELL_BORDER`: kiểu suy ra
  // từ hằng ấy khoá cứng `style: 'thin'`, nên `TOP_RULE` (dùng `'medium'` ở
  // cạnh trên) không lọt qua.
  opts: { border?: Partial<ExcelJS.Borders>; band?: string } = {},
): void {
  for (let column = 1; column <= columns; column += 1) {
    const cell = row.getCell(column);
    cell.border = opts.border ?? CELL_BORDER;
    if (opts.band) cell.fill = fill(opts.band);
    // Nhãn canh trái, số canh phải — quy ước bảng tài chính, và cũng là thứ
    // giúp mắt dò cột số mà không cần kẻ dọc đậm.
    cell.alignment = {
      ...cell.alignment,
      horizontal: column === 1 ? 'left' : 'right',
      vertical: 'middle',
    };
  }
  row.height = 18;
}

/** Hàng tiêu đề bảng: nền thương hiệu, chữ trắng, đóng băng ở nơi dùng. */
function dressHeader(row: ExcelJS.Row, columns: number): void {
  for (let column = 1; column <= columns; column += 1) {
    const cell = row.getCell(column);
    cell.fill = fill(BRAND);
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.border = CELL_BORDER;
    cell.alignment = { horizontal: column === 1 ? 'left' : 'right', vertical: 'middle' };
  }
  row.height = 22;
}

/** Cột A là lề; nội dung B:I (bản thảo D1). */
const SUMMARY_WIDTHS = [2, 14, 14, 13, 14, 13, 13, 13, 14];
const LAST = 'I';
/** Thanh dài nhất của thác nước (bằng doanh thu ghi nhận) là 30 ký tự — spec §6.2. */
const BAR_UNITS = 30;
/** Thanh tỉ trọng trạng thái: 100% là 40 ký tự (bản thảo D1). */
const SHARE_UNITS = 40;
const BLOCK = '█';

type LineKind = 'total' | 'cost' | 'subtotal' | 'net';

function put(
  cell: ExcelJS.Cell,
  value: ExcelJS.CellValue,
  font: Partial<ExcelJS.Font> = {},
): ExcelJS.Cell {
  cell.value = value;
  cell.font = bodyFont(font);
  return cell;
}

/** Nhãn nhỏ mono viết hoa: tiêu đề cột và nhãn ô số của dashboard. */
function smallLabel(cell: ExcelJS.Cell, text: string): void {
  put(cell, text.toUpperCase(), { name: MONO_FONT, size: 8, color: { argb: DIM } });
}

function section(sheet: ExcelJS.Worksheet, row: number, text: string): void {
  put(sheet.getCell(`B${row}`), text, { name: HEAD_FONT, size: 12.5, bold: true });
  sheet.getRow(row).height = 24;
}

/** Chuỗi █ làm giá trị đệm của ô REPT — đúng con số công thức sẽ tính khi Excel mở file. */
function bar(ratio: number, units: number): string {
  return BLOCK.repeat(Math.max(1, Math.round(ratio * units)));
}

/** Ô số đầu có ký hiệu khi là USD — đơn vị duy nhất của dự án (ADR-0034 giới hạn 3). */
function tileMoneyFmt(currency: string): string {
  return currency === 'USD' ? '"$"#,##0.00;("$"#,##0.00)' : MONEY_FMT;
}

/**
 * Tám chỉ số "Money and operations" — MỘT danh sách cho khối của Summary và sheet Operations, cùng
 * thứ tự với bảng trên màn hình (`toReportSummaryRows`).
 */
function operationsMetrics(
  report: AdminMonthlyReport,
): Array<[label: string, write: (cell: ExcelJS.Cell) => void]> {
  const o = t.operationsTable;
  return [
    [o.revenue, (cell) => money(cell, report.revenue)],
    [o.paidBookings, (cell) => count(cell, report.paidBookings)],
    [o.newBookings, (cell) => count(cell, report.newBookings)],
    [o.refundedTotal, (cell) => money(cell, report.refundedTotal)],
    [o.refunds, (cell) => count(cell, report.refunds)],
    [o.cancellationsWithinDeadline, (cell) => count(cell, report.cancellationsWithinDeadline)],
    [o.cancellationsAfterDeadline, (cell) => count(cell, report.cancellationsAfterDeadline)],
    [o.reviewsApproved, (cell) => count(cell, report.reviewsApproved)],
  ];
}

/** Màu thanh trạng thái: đã trả là phần "được", đã huỷ là phần mất, còn lại mực mờ. */
function statusColor(status: BookingStatusValue): string {
  if (status === 'PAID') return GAIN;
  return status === 'CANCELLED' ? COST : DIM;
}

function writeTiles(sheet: ExcelJS.Worksheet, report: AdminMonthlyReport): void {
  const c = t.cards;
  const tiles = [
    {
      from: 'B',
      to: 'C',
      label: c.recognizedRevenue,
      amount: report.recognizedRevenue,
      caption: c.recognizedCaption,
      tint: true,
    },
    {
      from: 'D',
      to: 'E',
      label: c.grossProfit,
      amount: report.grossProfit,
      caption: c.marginCaption(formatMarginPct(report.grossMarginPct)),
      tint: false,
    },
    {
      from: 'F',
      to: 'G',
      label: c.netProfit,
      amount: report.netProfit,
      caption: c.netCaption,
      tint: false,
    },
    {
      from: 'H',
      to: 'I',
      label: c.revenue,
      amount: report.revenue,
      caption: c.paidCaption(formatCount(report.paidBookings)),
      tint: false,
    },
  ];
  for (const tile of tiles) {
    for (const row of [5, 6, 7]) sheet.mergeCells(`${tile.from}${row}:${tile.to}${row}`);
    smallLabel(sheet.getCell(`${tile.from}5`), tile.label);
    const value = sheet.getCell(`${tile.from}6`);
    money(value, tile.amount);
    value.numFmt = tileMoneyFmt(report.currency);
    value.font = bodyFont({ size: 17, bold: true });
    put(sheet.getCell(`${tile.from}7`), tile.caption, { size: 9, color: { argb: DIM } });
    for (const row of [5, 6, 7]) {
      const cell = sheet.getCell(`${tile.from}${row}`);
      if (tile.tint) cell.fill = fill(PAPER);
      cell.alignment = { vertical: 'middle', indent: 1 };
      cell.border = {
        left: thin(),
        right: thin(),
        ...(row === 5 ? { top: thin() } : {}),
        ...(row === 7 ? { bottom: thin() } : {}),
      };
    }
  }
  sheet.getRow(5).height = 20;
  sheet.getRow(6).height = 28;
  sheet.getRow(7).height = 18;
}

/** "From revenue to net profit" từ hàng `start`; trả hàng cuối đã dùng (ghi chú, cảnh báo). */
function writeWaterfall(
  sheet: ExcelJS.Worksheet,
  report: AdminMonthlyReport,
  start: number,
): number {
  const p = t.pnlTable;
  section(sheet, start, t.waterfallHeading);
  const head = start + 1;
  sheet.mergeCells(`B${head}:D${head}`);
  sheet.mergeCells(`F${head}:${LAST}${head}`);
  smallLabel(sheet.getCell(`B${head}`), p.metric);
  smallLabel(sheet.getCell(`E${head}`), p.value);
  sheet.getCell(`E${head}`).alignment = { horizontal: 'right' };
  smallLabel(sheet.getCell(`F${head}`), x.shareOfRevenue);
  for (const column of 'BCDEFGHI') sheet.getCell(`${column}${head}`).border = { bottom: thin(INK) };

  const lines: Array<{ label: string; amount: string; kind: LineKind }> = [
    { label: p.recognizedRevenue, amount: report.recognizedRevenue, kind: 'total' },
    { label: p.cogsVariable, amount: report.cogsVariable, kind: 'cost' },
    { label: p.cogsFixed, amount: report.cogsFixed, kind: 'cost' },
    { label: p.grossProfit, amount: report.grossProfit, kind: 'subtotal' },
    { label: p.taxAmount(formatMarginPct(report.taxRate)), amount: report.taxAmount, kind: 'cost' },
    { label: p.paymentFees, amount: report.paymentFees, kind: 'cost' },
    { label: p.netProfit, amount: report.netProfit, kind: 'net' },
  ];
  const revenueRow = head + 1;
  const revenue = Number(report.recognizedRevenue);
  lines.forEach((line, index) => {
    const row = revenueRow + index;
    const cost = line.kind === 'cost';
    const value = Number(line.amount);
    sheet.mergeCells(`B${row}:D${row}`);
    sheet.mergeCells(`F${row}:${LAST}${row}`);
    put(sheet.getCell(`B${row}`), line.label, { bold: !cost }).alignment = {
      vertical: 'middle',
      indent: cost ? 2 : 0,
    };
    const amount = sheet.getCell(`E${row}`);
    money(amount, line.amount, { negate: cost });
    amount.font = bodyFont({ name: MONO_FONT, size: 10, bold: !cost });
    put(
      sheet.getCell(`F${row}`),
      {
        formula: `IF($E$${revenueRow}=0,"",REPT("${BLOCK}",MAX(1,ROUND(ABS(E${row})/$E$${revenueRow}*${BAR_UNITS},0))))`,
        result: revenue === 0 ? '' : bar(Math.abs(value) / revenue, BAR_UNITS),
      },
      { size: 10, color: { argb: cost || value < 0 ? COST : GAIN } },
    ).alignment = { vertical: 'middle' };
    sheet.getRow(row).height = 20;
    if (line.kind === 'subtotal') {
      for (const column of 'BCDE') sheet.getCell(`${column}${row}`).border = { top: thin(INK) };
    }
    if (line.kind === 'net') {
      for (const column of 'BCDE') {
        sheet.getCell(`${column}${row}`).border = {
          top: thin(INK),
          bottom: { style: 'double', color: { argb: INK } },
        };
      }
    }
  });

  let last = revenueRow + lines.length;
  put(sheet.getCell(`B${last}`), p.departuresRun(formatCount(report.departuresRun)), {
    size: 9,
    italic: true,
    color: { argb: DIM },
  });
  // Quyết định 5 của plan: thiếu giá vốn thì file phải tự nói, không để "lãi gộp" đứng một mình.
  const warning = costWarning(report);
  if (warning !== null) {
    last += 1;
    put(sheet.getCell(`B${last}`), warning, { size: 9, italic: true, color: { argb: COST } });
  }
  return last;
}

/** "Bookings created this month" từ hàng `start`; trả hàng Total. */
function writeStatusShare(
  sheet: ExcelJS.Worksheet,
  report: AdminMonthlyReport,
  start: number,
): number {
  section(sheet, start, t.bookingsTable.heading);
  const head = start + 1;
  smallLabel(sheet.getCell(`B${head}`), t.bookingsTable.status);
  smallLabel(sheet.getCell(`C${head}`), t.bookingsTable.count);
  smallLabel(sheet.getCell(`D${head}`), x.share);
  for (const column of 'BCDEFGHI') sheet.getCell(`${column}${head}`).border = { bottom: thin(INK) };

  const first = head + 1;
  const total = first + report.bookingsByStatus.length;
  report.bookingsByStatus.forEach(({ status, count: bookings }, index) => {
    const row = first + index;
    put(sheet.getCell(`B${row}`), statusLabel(status));
    const countCell = sheet.getCell(`C${row}`);
    count(countCell, bookings);
    countCell.font = bodyFont({ name: MONO_FONT, size: 10 });
    const share = sheet.getCell(`D${row}`);
    share.value = {
      formula: `IF($C$${total}=0,0,C${row}/$C$${total})`,
      result: report.newBookings === 0 ? 0 : bookings / report.newBookings,
    };
    share.numFmt = PCT_FMT;
    share.font = bodyFont({ name: MONO_FONT, size: 10 });
    sheet.mergeCells(`E${row}:${LAST}${row}`);
    put(
      sheet.getCell(`E${row}`),
      {
        formula: `IF(C${row}=0,"",REPT("${BLOCK}",MAX(1,ROUND(D${row}*${SHARE_UNITS},0))))`,
        result: bookings === 0 ? '' : bar(bookings / report.newBookings, SHARE_UNITS),
      },
      { color: { argb: statusColor(status) } },
    );
  });
  put(sheet.getCell(`B${total}`), t.bookingsTable.total, { bold: true });
  const sum = sheet.getCell(`C${total}`);
  sum.value = { formula: `SUM(C${first}:C${total - 1})`, result: report.newBookings };
  sum.numFmt = COUNT_FMT;
  sum.font = bodyFont({ name: MONO_FONT, size: 10, bold: true });
  for (const column of 'BCD') sheet.getCell(`${column}${total}`).border = { top: thin(INK) };
  return total;
}

/** "Money and operations" hai cột từ hàng `start`; trả hàng của dòng chỉ sang Definitions. */
function writeOperations(
  sheet: ExcelJS.Worksheet,
  report: AdminMonthlyReport,
  start: number,
): number {
  section(sheet, start, t.operationsTable.heading);
  operationsMetrics(report).forEach(([label, write], index) => {
    const row = start + 1 + (index % 4);
    const left = index < 4;
    sheet.mergeCells(left ? `B${row}:D${row}` : `F${row}:H${row}`);
    put(sheet.getCell(`${left ? 'B' : 'F'}${row}`), label);
    const value = sheet.getCell(`${left ? 'E' : 'I'}${row}`);
    write(value);
    value.font = bodyFont({ name: MONO_FONT, size: 10, bold: true });
    for (const column of left ? 'BCDE' : 'FGHI') {
      sheet.getCell(`${column}${row}`).border = { bottom: thin() };
    }
  });
  return start + 6;
}

function buildSummary(
  book: ExcelJS.Workbook,
  report: AdminMonthlyReport,
  frame: Partial<ExcelJS.HeaderFooter>,
): void {
  const sheet = addSheet(book, x.sheets.summary, { tab: BRAND, grid: false, frame });
  sheet.columns = SUMMARY_WIDTHS.map((width) => ({ width }));

  sheet.mergeCells(`B2:${LAST}2`);
  put(sheet.getCell('B2'), t.reportTitle(formatMonthLabel(report.month)), {
    name: HEAD_FONT,
    size: 20,
    bold: true,
  });
  sheet.getRow(2).height = 34;
  sheet.mergeCells(`B3:${LAST}3`);
  put(
    sheet.getCell('B3'),
    t.periodLine(reportPeriodLabel(report), report.currency, formatMarginPct(report.taxRate)),
    { color: { argb: DIM } },
  );

  writeTiles(sheet, report);
  const waterfallEnd = writeWaterfall(sheet, report, 9);
  const statusEnd = writeStatusShare(sheet, report, waterfallEnd + 2);
  const footnote = writeOperations(sheet, report, statusEnd + 2);
  put(sheet.getCell(`B${footnote}`), x.seeDefinitions, {
    size: 9,
    italic: true,
    color: { argb: DIM },
  });
  sheet.pageSetup.printArea = `A1:${LAST}${footnote}`;
}

function buildBookings(book: ExcelJS.Workbook, report: AdminMonthlyReport): void {
  const sheet = book.addWorksheet(x.sheets.bookings);
  sheet.columns = [
    { header: t.bookingsTable.status, key: 'status', width: 26 },
    { header: t.bookingsTable.count, key: 'count', width: 14 },
  ];
  dressHeader(sheet.getRow(1), 2);

  report.bookingsByStatus.forEach((row, index) => {
    const added = sheet.addRow([statusLabel(row.status)]);
    // Dải xen kẽ: mắt dò ngang một bảng nhiều hàng mà không lạc dòng.
    dressRow(added, 2, index % 2 === 1 ? { band: BAND } : {});
    count(added.getCell(2), row.count);
  });

  const total = sheet.addRow([t.bookingsTable.total]);
  dressRow(total, 2, { border: TOP_RULE, band: BRAND_SOFT });
  total.getCell(1).font = { bold: true, color: { argb: INK } };
  count(total.getCell(2), report.newBookings);
  total.getCell(2).font = { bold: true, color: { argb: INK } };

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };
}

function buildOperations(book: ExcelJS.Workbook, report: AdminMonthlyReport): void {
  const sheet = book.addWorksheet(x.sheets.operations);
  sheet.columns = [
    { header: t.operationsTable.metric, key: 'metric', width: 34 },
    { header: t.operationsTable.value, key: 'value', width: 18 },
  ];
  dressHeader(sheet.getRow(1), 2);

  const o = t.operationsTable;
  const rows: Array<[string, (cell: ExcelJS.Cell) => void]> = [
    [o.refundedTotal, (cell) => money(cell, report.refundedTotal)],
    [o.refunds, (cell) => count(cell, report.refunds)],
    [o.paidBookings, (cell) => count(cell, report.paidBookings)],
    [o.newBookings, (cell) => count(cell, report.newBookings)],
    [o.cancellationsWithinDeadline, (cell) => count(cell, report.cancellationsWithinDeadline)],
    [o.cancellationsAfterDeadline, (cell) => count(cell, report.cancellationsAfterDeadline)],
    [o.reviewsApproved, (cell) => count(cell, report.reviewsApproved)],
  ];
  rows.forEach(([label, write], index) => {
    const row = sheet.addRow([label]);
    dressRow(row, 2, index % 2 === 1 ? { band: BAND } : {});
    write(row.getCell(2));
  });

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
function buildDetail(
  book: ExcelJS.Workbook,
  bookings: readonly Booking[],
  note: string | undefined,
): void {
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
  // `columnCount` là GETTER duyệt mọi hàng của sheet — gọi nó trong vòng lặp
  // là O(n²) trên 2000 hàng (vòng vá review 05/09). Số cột là hằng do
  // `sheet.columns` khai, đọc một lần.
  const columns = sheet.columnCount;
  dressHeader(sheet.getRow(1), columns);

  // Lý do sheet thiếu hàng (hoặc lệch số) in NGAY DƯỚI tiêu đề, trong file —
  // vết audit phía server là thứ người tải không bao giờ thấy.
  if (note) {
    const row = sheet.addRow([note]);
    sheet.mergeCells(row.number, 1, row.number, columns);
    row.getCell(1).font = { italic: true, color: { argb: DIM } };
    row.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
    row.height = 30;
  }

  bookings.forEach((booking, index) => {
    const row = sheet.addRow([booking.code, booking.tourTitle]);
    dressRow(row, columns, index % 2 === 1 ? { band: BAND } : {});
    // Hai cột chữ canh trái; `dressRow` mặc định canh phải từ cột 2 trở đi.
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
    const ends = row.getCell(3);
    // Ô NGÀY thật, không phải chuỗi: người đọc lọc và sắp xếp được theo nó.
    ends.value = new Date(booking.departureEndDate);
    ends.numFmt = DATE_FMT;
    count(row.getCell(4), booking.numAdults + booking.numChildren);
    money(row.getCell(5), booking.totalAmount);
    money(row.getCell(6), booking.refundedTotal);
    row.getCell(7).value = statusLabel(booking.status);
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  // Bộ lọc trên hàng tiêu đề — thứ biến sheet này thành công cụ kiểm chéo
  // thay vì một danh sách để nhìn. Vùng lọc phủ TỚI hàng cuối: `ref` chỉ có
  // hàng 1 thì Excel desktop tự nới nhưng LibreOffice/Google Sheets tôn trọng
  // `ref` và lọc trên đúng một hàng (vòng vá review 05/09).
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, sheet.rowCount), column: columns } };
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
  heading.getCell(1).font = { bold: true, size: 13, color: { argb: WHITE } };
  heading.getCell(1).fill = fill(BRAND);
  heading.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  heading.height = 26;
  sheet.addRow([]);

  for (const line of [
    t.definitions.revenue,
    t.definitions.recognised,
    t.definitions.costs,
    t.definitions.netProfit,
    t.definitions.refunds,
    t.definitions.statuses,
    t.definitions.cancellations,
  ]) {
    const row = sheet.addRow([line]);
    const cell = row.getCell(1);
    cell.alignment = { wrapText: true, vertical: 'top', indent: 1 };
    cell.font = { color: { argb: INK } };
    cell.border = { bottom: { style: 'hair', color: { argb: RULE } } };
    row.height = 32;
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
  /** Câu ghi trong sheet Detail khi nó thiếu hàng hoặc lệch số với Summary. */
  detailNote?: string,
): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const monthLabel = formatMonthLabel(report.month);
  stampWorkbook(book, {
    title: x.docTitle(report.month),
    subject: x.subject(monthLabel),
    created: new Date(report.generatedAt),
  });
  const frame = printFrame(x.headerCenter(monthLabel), report.generatedAt);

  buildSummary(book, report, frame);
  buildBookings(book, report);
  buildOperations(book, report);
  buildDetail(book, bookings, detailNote);
  buildDefinitions(book);

  // ExcelJS khai kiểu trả về là `Buffer` của RIÊNG nó
  // (`interface Buffer extends ArrayBuffer {}`), không phải `Buffer` của Node —
  // ép sang kiểu Node là typecheck đỏ. `ArrayBuffer` là thứ nó thật sự trả, và
  // cũng là thứ `Response` nhận thẳng làm body.
  return (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
