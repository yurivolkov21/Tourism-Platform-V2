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

/**
 * Âm trong NGOẶC và tô ĐỎ — quy ước báo cáo tài chính. Dấu ngoặc là cách kế
 * toán viết số âm; màu đỏ là để mắt bắt được một tháng lỗ mà không phải đọc
 * từng ô.
 */
const MONEY_FMT = '#,##0.00;[Red](#,##0.00)';
const PCT_FMT = '0.0%';
const COUNT_FMT = '#,##0';
const DATE_FMT = 'dd mmm yyyy';

const t = messages.admin.reports;
const x = t.xlsx;

/**
 * Bảng màu — quy đổi từ CHÍNH token của dự án (`oklch` → ARGB hex), không bịa
 * màu mới.
 *
 * NGOẠI LỆ CÓ CHỦ ĐÍCH với luật tokens-only (CLAUDE.md #6), cùng họ với khối
 * `@media print` và lớp bề mặt admin ở `globals.css`: một file `.xlsx` không
 * có CSS custom property nào để mà tham chiếu — ExcelJS đòi hex tuyệt đối.
 * Nên đây là nơi TIÊU THỤ token dưới dạng đã quy đổi, và bảng dưới ghi kèm
 * `oklch` gốc để đối chiếu được khi token đổi.
 */
const INK = 'FF1F252B'; // oklch(0.262 0.014 250) — --foreground của admin
const DIM = 'FF5F646B'; // oklch(0.502 0.012 250) — --muted-foreground
const RULE = 'FFDCDFE2'; // oklch(0.902 0.005 250) — --border
const BAND = 'FFF0F3F5'; // oklch(0.962 0.004 250) — --muted
const BRAND = 'FF2E6E66'; // oklch(0.494 0.067 184.3) — --primary
// DẪN XUẤT, không phải token: `--primary` pha 15% trên nền trắng (sRGB blend,
// ADR-0034 AMEND 2) — bảng token không có teal nhạt, và bịa một hex rời là
// thứ AMEND 1b cấm. Đổi `--primary` thì tính lại từ công thức này.
const BRAND_SOFT = 'FFDFE9E8'; // 0.85·#FFFFFF + 0.15·#2E6E66 — nền dải tiêu đề khối
const PAPER = 'FFFFFFFF';

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

const fill = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const;

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
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.border = CELL_BORDER;
    cell.alignment = { horizontal: column === 1 ? 'left' : 'right', vertical: 'middle' };
  }
  row.height = 22;
}

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
  dressRow(row, 2, opts.total ? { border: TOP_RULE, band: BAND } : {});

  if (opts.indent) {
    // Thụt một cấp: dòng này là THÀNH PHẦN của phép trừ ngay trên nó, không
    // phải một con số ngang hàng.
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
    row.getCell(1).font = { color: { argb: DIM } };
  }
  if (opts.total) {
    row.getCell(1).font = { bold: true, color: { argb: INK } };
    row.getCell(2).font = { bold: true, color: { argb: INK } };
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
  // Dải tiêu đề chiếm trọn bề ngang bảng — thứ đầu tiên mắt chạm khi mở file.
  sheet.mergeCells('A1:B1');
  const title = sheet.getCell('A1');
  title.value = x.title;
  title.font = { size: 15, bold: true, color: { argb: PAPER } };
  title.fill = fill(BRAND);
  title.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  sheet.getRow(1).height = 30;

  for (const [label, value, fmt] of [
    [x.period, reportPeriodLabel(report)],
    [x.generatedAt, formatDateTime(report.generatedAt)],
    [x.currency, report.currency],
    [x.taxRate, report.taxRate, PCT_FMT],
  ] as Array<[string, string | number, string?]>) {
    const row = sheet.addRow([label, value]);
    dressRow(row, 2, { band: BAND });
    row.getCell(1).font = { bold: true, color: { argb: DIM } };
    if (fmt) row.getCell(2).numFmt = fmt;
  }
  sheet.addRow([]);
}

/**
 * Tiêu đề một khối trong Summary — dải teal nhạt chạy trọn bề ngang.
 *
 * Đây là thứ chia hai cách đọc tiền ra làm hai khối nhìn thấy được: người mở
 * file phải biết ngay chỗ nào là dòng tiền, chỗ nào là kết quả kinh doanh, vì
 * hai khối ấy KHÔNG cộng vào nhau được.
 */
function sectionRow(sheet: ExcelJS.Worksheet, label: string): void {
  const row = sheet.addRow([label]);
  dressRow(row, 2, { band: BRAND_SOFT });
  row.getCell(1).font = { bold: true, size: 12, color: { argb: BRAND } };
  row.height = 24;
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
  count(labelRow(sheet, x.departuresCostMissing).getCell(2), report.departuresCostMissing);

  sheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
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
    [o.cancellationsApproved, (cell) => count(cell, report.cancellationsApproved)],
    [o.cancellationsDenied, (cell) => count(cell, report.cancellationsDenied)],
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
  heading.getCell(1).font = { bold: true, size: 13, color: { argb: PAPER } };
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
  book.created = new Date(report.generatedAt);

  buildSummary(book, report);
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
