import type { AdminMonthlyReport, Booking, BookingStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { guestCount, statusLabel } from './bookings-view';
import { formatMonthLabel } from './month-options';
import { costWarning, formatMarginPct, reportPeriodLabel } from './reports-view';
import { formatCount } from './stats-view';
import {
  addSheet,
  BRAND,
  bodyFont,
  bookingLink,
  COST,
  COUNT_FMT,
  calendarDate,
  count,
  DATE_FMT,
  DIM,
  fill,
  freezeHeader,
  GAIN,
  HEAD_FONT,
  headerRow,
  INK,
  MONEY_FMT,
  MONO_FONT,
  money,
  PAPER,
  PCT_FMT,
  printFrame,
  RULE,
  stampWorkbook,
  stripe,
  subtotalRow,
  sumMoney,
  thin,
} from './xlsx-style';

/**
 * Dựng file Excel của báo cáo tháng (ADR-0034) — THUẦN: nhận dữ liệu, trả
 * `Buffer`. Không đọc cookie, không fetch, không đụng Next — nên mọi ô test
 * được bằng cách mở lại chính buffer vừa dựng.
 *
 * File theo bản thảo D1 (ADR-0034 AMEND 3, spec G40 §6); đồ nghề chung ở `xlsx-style.ts`.
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

const DATA_TAB = DIM;

function buildBookings(
  book: ExcelJS.Workbook,
  report: AdminMonthlyReport,
  frame: Partial<ExcelJS.HeaderFooter>,
): void {
  const sheet = addSheet(book, x.sheets.bookings, { tab: DATA_TAB, grid: true, frame });
  sheet.columns = [24, 14, 12].map((width) => ({ width }));
  headerRow(sheet, [t.bookingsTable.status, t.bookingsTable.count, x.share]);

  const first = 2;
  const total = first + report.bookingsByStatus.length;
  report.bookingsByStatus.forEach(({ status, count: bookings }, index) => {
    const row = sheet.getRow(first + index);
    put(row.getCell(1), statusLabel(status), { size: 10 });
    count(row.getCell(2), bookings);
    row.getCell(2).font = bodyFont({ name: MONO_FONT, size: 10 });
    row.getCell(3).value = {
      formula: `IF($B$${total}=0,0,B${first + index}/$B$${total})`,
      result: report.newBookings === 0 ? 0 : bookings / report.newBookings,
    };
    row.getCell(3).numFmt = PCT_FMT;
    row.getCell(3).font = bodyFont({ name: MONO_FONT, size: 10 });
    stripe(row, 3, index);
  });
  const totalRow = sheet.getRow(total);
  put(totalRow.getCell(1), t.bookingsTable.total, { size: 10, bold: true });
  totalRow.getCell(2).value = {
    formula: `SUM(B${first}:B${total - 1})`,
    result: report.newBookings,
  };
  totalRow.getCell(2).numFmt = COUNT_FMT;
  totalRow.getCell(2).font = bodyFont({ name: MONO_FONT, size: 10, bold: true });
  for (let column = 1; column <= 3; column += 1) {
    totalRow.getCell(column).border = { top: thin(INK) };
  }

  freezeHeader(sheet, true);
  sheet.pageSetup.printTitlesRow = '1:1';
}

function buildOperations(
  book: ExcelJS.Workbook,
  report: AdminMonthlyReport,
  frame: Partial<ExcelJS.HeaderFooter>,
): void {
  const sheet = addSheet(book, x.sheets.operations, { tab: DATA_TAB, grid: true, frame });
  sheet.columns = [34, 16].map((width) => ({ width }));
  headerRow(sheet, [t.operationsTable.metric, t.operationsTable.value]);
  operationsMetrics(report).forEach(([label, write], index) => {
    const row = sheet.getRow(2 + index);
    put(row.getCell(1), label, { size: 10 });
    write(row.getCell(2));
    row.getCell(2).font = bodyFont({ name: MONO_FONT, size: 10 });
    stripe(row, 2, index);
  });
  freezeHeader(sheet, true);
  sheet.pageSetup.printTitlesRow = '1:1';
}

/**
 * Từng booking TẠO trong tháng (ADR-0034 AMEND 1a) — thứ khiến báo cáo kiểm chéo được. Tập này KHÔNG
 * phải tập của khối lãi lỗ (neo ngày chuyến kết thúc); tên sheet nói thẳng điều đó.
 *
 * Dòng ghi chú (AMEND 2b) nằm DƯỚI hàng Total (quyết định 8 của plan): ô merge trong vùng lọc làm
 * Excel từ chối sắp xếp. Bảng trống thì nó là hàng 2, ngay dưới tiêu đề.
 */
function buildDetail(
  book: ExcelJS.Workbook,
  bookings: readonly Booking[],
  {
    note,
    adminOrigin,
    frame,
  }: { note?: string; adminOrigin: string; frame: Partial<ExcelJS.HeaderFooter> },
): void {
  const sheet = addSheet(book, x.sheets.detail, {
    tab: DATA_TAB,
    grid: true,
    landscape: true,
    frame,
  });
  sheet.columns = [16, 46, 19, 14, 15, 15, 14].map((width) => ({ width }));
  const d = x.detail;
  headerRow(sheet, [d.code, d.tour, d.departureEnds, d.travellers, d.total, d.refunded, d.status]);
  const columns = 7;

  const first = 2;
  bookings.forEach((booking, index) => {
    const row = sheet.getRow(first + index);
    bookingLink(row.getCell(1), booking.code, adminOrigin);
    put(row.getCell(2), booking.tourTitle, { size: 10 });
    const ends = row.getCell(3);
    ends.value = calendarDate(booking.departureEndDate);
    ends.numFmt = DATE_FMT;
    ends.font = bodyFont({ size: 10 });
    count(row.getCell(4), guestCount(booking));
    money(row.getCell(5), booking.totalAmount);
    money(row.getCell(6), booking.refundedTotal);
    for (const column of [4, 5, 6]) {
      row.getCell(column).font = bodyFont({ name: MONO_FONT, size: 10 });
    }
    put(row.getCell(7), statusLabel(booking.status), {
      size: 10,
      color: { argb: booking.status === 'CANCELLED' ? COST : INK },
    });
    stripe(row, columns, index);
  });

  const last = first + bookings.length - 1;
  subtotalRow(sheet, t.bookingsTable.total, { first, last }, columns, [
    {
      column: 4,
      result: bookings.reduce((sum, booking) => sum + guestCount(booking), 0),
      numFmt: COUNT_FMT,
    },
    {
      column: 5,
      result: sumMoney(bookings.map((booking) => booking.totalAmount)),
      numFmt: MONEY_FMT,
    },
    {
      column: 6,
      result: sumMoney(bookings.map((booking) => booking.refundedTotal)),
      numFmt: MONEY_FMT,
    },
  ]);

  if (note) {
    const noteRow = bookings.length === 0 ? 2 : last + 3;
    sheet.mergeCells(noteRow, 1, noteRow, columns);
    const cell = put(sheet.getCell(noteRow, 1), note, {
      size: 10,
      italic: true,
      color: { argb: DIM },
    });
    cell.alignment = { wrapText: true, vertical: 'middle' };
    sheet.getRow(noteRow).height = 30;
  }

  freezeHeader(sheet, true);
  // Vùng lọc tới hàng DỮ LIỆU cuối (AMEND 2c), không gồm hàng Total (quyết định 9).
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, last), column: columns } };
  sheet.pageSetup.printTitlesRow = '1:1';
}

/** Khối "How to read these numbers" — đi kèm MỌI bản xuất: file rời màn hình thì không còn tooltip. */
function buildDefinitions(book: ExcelJS.Workbook, frame: Partial<ExcelJS.HeaderFooter>): void {
  const sheet = addSheet(book, x.sheets.definitions, { tab: RULE, grid: false, frame });
  sheet.columns = [2, 5, 100].map((width) => ({ width }));
  put(sheet.getCell('B2'), t.definitions.heading, { name: HEAD_FONT, size: 15, bold: true });
  sheet.getRow(2).height = 28;
  const d = t.definitions;
  [d.revenue, d.recognised, d.costs, d.netProfit, d.refunds, d.statuses, d.cancellations].forEach(
    (line, index) => {
      const row = 4 + index;
      put(sheet.getCell(`B${row}`), index + 1, {
        name: MONO_FONT,
        size: 10,
        bold: true,
        color: { argb: BRAND },
      }).alignment = { vertical: 'top' };
      put(sheet.getCell(`C${row}`), line).alignment = { wrapText: true, vertical: 'top' };
      // Excel không tự giãn hàng khi mở file: ước ~95 ký tự một dòng ở cột rộng 100.
      sheet.getRow(row).height = Math.max(30, Math.ceil(line.length / 95) * 15 + 4);
    },
  );
}

/**
 * Toàn bộ workbook. `bookings` là tập của sheet Detail; mảng rỗng thì sheet vẫn có mặt với hàng tiêu
 * đề — một sheet BIẾN MẤT khi tháng vắng làm hai file cùng tháng khác cấu trúc. `adminOrigin` dựng
 * hyperlink mã đơn (quyết định 11 của plan).
 */
export async function buildReportWorkbook(
  report: AdminMonthlyReport,
  bookings: readonly Booking[],
  { detailNote, adminOrigin }: { detailNote?: string; adminOrigin: string },
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
  buildBookings(book, report, frame);
  buildOperations(book, report, frame);
  buildDetail(book, bookings, { note: detailNote, adminOrigin, frame });
  buildDefinitions(book, frame);

  // ExcelJS khai kiểu trả về là `Buffer` của RIÊNG nó, không phải `Buffer` của Node — ép sang kiểu
  // Node là typecheck đỏ. `ArrayBuffer` là thứ nó thật sự trả, và `Response` nhận thẳng làm body.
  return (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
