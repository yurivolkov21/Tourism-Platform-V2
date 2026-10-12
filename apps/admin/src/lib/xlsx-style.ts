import { fromCents, toCents } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type ExcelJS from 'exceljs';
import { formatDateTime } from './bookings-view';

/**
 * Bộ đồ nghề chung của mọi file Excel admin xuất (G40, ADR-0034 AMEND 3, spec §6.1): bảng màu, font,
 * định dạng số và ngày, khung trang in, và vài hàm ghi ô. Báo cáo tháng và hai danh sách dùng chung
 * để ba file trông cùng một nhà.
 *
 * Bảng màu là NGOẠI LỆ có chủ đích của luật tokens-only (CLAUDE.md #6): `.xlsx` không có CSS custom
 * property, ExcelJS đòi hex tuyệt đối. Mỗi hằng hoặc là token quy đổi (`oklch` → ARGB, ghi gốc cạnh
 * nó), hoặc dẫn xuất từ token có công thức (ADR-0034 AMEND 2d) — không có loại thứ ba.
 */
export const INK = 'FF1F252B'; // oklch(0.262 0.014 250) — --foreground của admin
export const DIM = 'FF5F646B'; // oklch(0.502 0.012 250) — --muted-foreground
export const RULE = 'FFDCDFE2'; // oklch(0.902 0.005 250) — --border
export const BAND = 'FFF0F3F5'; // oklch(0.962 0.004 250) — --muted
export const BRAND = 'FF2E6E66'; // oklch(0.494 0.067 184.3) — --primary
// DẪN XUẤT: 0.85·#FFFFFF + 0.15·#2E6E66 (ADR-0034 AMEND 2d) — đổi `--primary` thì tính lại.
export const BRAND_SOFT = 'FFDFE9E8';
export const PAPER = 'FFEEF5F3'; // oklch(0.965 0.008 174) — token `paper` (nền ô số đầu, như bản in)
export const GAIN = 'FF00897B'; // oklch(0.566 0.101 182.5) — token `chart-gain` (ADR-0057 §5)
export const COST = 'FFE0703A'; // oklch(0.667 0.155 44.4) — token `chart-cost` (ADR-0057 §5)
export const WHITE = 'FFFFFFFF';

export const BODY_FONT = 'Calibri';
export const HEAD_FONT = 'Cambria';
export const MONO_FONT = 'Consolas';

/** Âm trong NGOẶC — quy ước báo cáo tài chính (bản thảo D1 bỏ tô đỏ: thanh đã nói chiều âm). */
export const MONEY_FMT = '#,##0.00;(#,##0.00)';
export const COUNT_FMT = '#,##0';
export const PCT_FMT = '0.0%';
/**
 * `[$-409]` ép tên tháng tiếng Anh: không ép thì Excel lấy theo Windows — máy vi-VN ra "5 Thg10 2026"
 * (đo 10/10, ADR-0034 AMEND 3 mục 4).
 */
export const DATE_FMT = '[$-409]d mmm yyyy';
export const DATETIME_FMT = '[$-409]d mmm yyyy hh:mm';

/** Giờ Việt Nam: UTC+7, không có giờ mùa hè. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Phần giữa đầu trang hiện tối đa 100 ký tự cho gọn tờ in. */
const HEADER_CENTER_MAX = 100;
/** Cả đầu trang tối đa 255 ký tự, kể cả mã định dạng, đếm SAU khi nhân đôi `&` — Excel không mở file vượt. */
const HEADER_MAX = 255;

/** Ký tự XML 1.0 cho phép: tab, LF, CR, U+0020–U+D7FF, U+E000–U+FFFD, U+10000–U+10FFFF. */
const XML_ILLEGAL = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;
/** Mở đầu khiến Excel đọc CSV thành công thức: = + - @ tab CR. */
const FORMULA_START = /^[=+\-@\t\r]/;
/** Số điện thoại hay số thường: chữ số, khoảng trắng, + - ( ) . — không có hàm nào để chạy. */
const PLAIN_NUMBER = /^[+-]?[\d\s().-]+$/;

export function fill(argb: string): ExcelJS.FillPattern {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

export function thin(argb: string = RULE): Partial<ExcelJS.Border> {
  return { style: 'thin', color: { argb } };
}

/** Font thân (Calibri 10.5, mực INK); đè từng thuộc tính khi cần. */
export function bodyFont(overrides: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: BODY_FONT, size: 10.5, color: { argb: INK }, ...overrides };
}

/**
 * Ghi tiền vào ô: chỗ đổi chuỗi decimal ra `Number` (ADR-0034 §2: không tính tiền trên `number`) —
 * Excel không có kiểu decimal. Nằm SAU mọi phép cộng của server. `negate` chỉ đổi dấu để dòng chi phí
 * đọc là số âm; số 0 giữ là 0 (không ghi -0).
 */
export function money(cell: ExcelJS.Cell, decimal: string, { negate = false } = {}): void {
  const value = Number(decimal);
  cell.value = negate && value !== 0 ? -value : value;
  cell.numFmt = MONEY_FMT;
}

export function count(cell: ExcelJS.Cell, value: number): void {
  cell.value = value;
  cell.numFmt = COUNT_FMT;
}

/**
 * Giá trị đệm (`result`) của ô tổng tiền: cộng theo XU nguyên bằng `toCents`/`fromCents` của contract
 * — cùng phép làm tròn HALF_UP với server, không bản chép thứ hai. Excel tính lại công thức khi mở;
 * giá trị này chỉ cho trình xem không tự tính. Chỉ nhận số không âm (tổng tiền, tiền đã hoàn).
 */
export function sumMoney(values: readonly string[]): number {
  return Number(fromCents(values.reduce((cents, value) => cents + toCents(value), 0)));
}

/** Chữ hợp lệ trong XML của file: bỏ ký tự XML 1.0 cấm — ExcelJS ghi thẳng U+FFFE/U+FFFF ra file hỏng. */
function xmlText(text: string): string {
  return text.replace(XML_ILLEGAL, '');
}

/**
 * Chữ do người dùng nhập (tên, email, số điện thoại, nguồn đăng ký, tên tour) trước khi vào ô (review
 * max G40 Phần 3):
 * - bỏ ký tự XML cấm — một U+FFFF trong ô nguồn của form đăng ký công khai từng làm mọi lần xuất file
 *   subscribers ra file Excel không mở được;
 * - chữ mở đầu bằng = + - @ hay tab thì thêm dấu nháy: ô `.xlsx` không bao giờ chạy chuỗi như công
 *   thức, nhưng Save As CSV rồi mở lại (ADR-0034 AMEND 3 chỉ cách ấy cho ai cần CSV) thì có. Số điện
 *   thoại và số thường không có hàm nào để chạy nên giữ nguyên.
 */
export function cellText(text: string): string {
  const clean = xmlText(text);
  return FORMULA_START.test(clean) && !PLAIN_NUMBER.test(clean) ? `'${clean}` : clean;
}

/** Ngày lịch `YYYY-MM-DD` → ô ngày: nửa đêm UTC (ExcelJS ghi `Date` theo UTC). */
export function calendarDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * Mốc ISO → ô ngày-giờ theo GIỜ VIỆT NAM (ADR-0034 AMEND 3 mục 3). Excel không có múi giờ và ExcelJS
 * ghi `Date` theo UTC, nên cộng 7 giờ trước khi ghi: ô hiện đúng giờ đồng hồ ở Việt Nam. Bỏ phần nghìn
 * giây: Excel làm tròn tới giây gần nhất rồi mới áp `hh:mm`, nên 23:59:59.999 từng hiện 00:00 ngày hôm
 * sau trong khi màn admin cắt bỏ (review max G40 Phần 3).
 */
export function vietnamDateTime(iso: string): Date {
  return new Date(Math.floor((Date.parse(iso) + VIETNAM_OFFSET_MS) / 1000) * 1000);
}

/** Ô ngày-giờ theo giờ Việt Nam, hoặc để TRỐNG khi mốc vắng — ô trống là "không có giá trị". */
export function dateTime(cell: ExcelJS.Cell, iso: string | null): void {
  if (iso === null) return;
  cell.value = vietnamDateTime(iso);
  cell.numFmt = DATETIME_FMT;
}

/** `&` trong chữ của đầu, chân trang là mã điều khiển của Excel — chữ thật phải nhân đôi. */
export function headerText(text: string): string {
  return text.replaceAll('&', '&&');
}

/**
 * Đầu và chân trang khi in (spec §6.1, §7.1): trái "Nexora back office", giữa tên tài liệu, phải
 * "Internal — not for distribution"; chân trái giờ tạo (UTC — mọi mốc của back-office in UTC), chân
 * phải "Page &P of &N" (mã của Excel, không nhân đôi).
 */
export function printFrame(center: string, generatedAt: string): Partial<ExcelJS.HeaderFooter> {
  const f = messages.admin.exportFile;
  const left = `&L&"${BODY_FONT},Bold"${headerText(f.backOffice)}`;
  const middle = `&C&"${BODY_FONT},Regular"`;
  const right = `&R&"${BODY_FONT},Regular"${headerText(f.internal)}`;
  return {
    oddHeader: `${left}${middle}${fitHeader(center, HEADER_MAX - left.length - middle.length - right.length)}${right}`,
    oddFooter: `&L&"${BODY_FONT},Regular"${headerText(f.generated(formatDateTime(generatedAt)))}&R&"${BODY_FONT},Regular"${f.pageOf}`,
  };
}

/**
 * Phần giữa đầu trang: tối đa `HEADER_CENTER_MAX` ký tự hiện, rồi cắt tiếp cho tới khi bản ĐÃ nhân đôi
 * `&` vừa `room` — cắt trước khi nhân đôi từng cho đầu trang 286 ký tự (review max G40 Phần 3). Cắt
 * theo điểm mã, không xẻ đôi cặp surrogate; dấu `&` nhân đôi trọn cặp nên không lẻ ở chỗ cắt.
 */
function fitHeader(text: string, room: number): string {
  const chars = Array.from(xmlText(text));
  const take = (n: number) =>
    n >= chars.length ? headerText(chars.join('')) : `${headerText(chars.slice(0, n).join(''))}…`;
  let n = chars.length > HEADER_CENTER_MAX ? HEADER_CENTER_MAX - 1 : chars.length;
  while (n > 0 && take(n).length > room) n -= 1;
  return take(n);
}

export interface SheetOptions {
  tab: string;
  grid: boolean;
  landscape?: boolean;
  frame: Partial<ExcelJS.HeaderFooter>;
}

/** Sheet theo khung chung (spec §6.1): A4, vừa một trang ngang, căn giữa ngang, lề 0.5″ / 0.8″. */
export function addSheet(
  book: ExcelJS.Workbook,
  name: string,
  { tab, grid, landscape = false, frame }: SheetOptions,
): ExcelJS.Worksheet {
  return book.addWorksheet(name, {
    properties: { tabColor: { argb: tab }, defaultRowHeight: 18 },
    views: [{ showGridLines: grid }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.8, bottom: 0.8, header: 0.3, footer: 0.3 },
    },
    headerFooter: frame,
  });
}

/** Đóng băng hàng 1, GIỮ cờ lưới — gán `views` mới là ghi đè cả `showGridLines` của `addSheet`. */
export function freezeHeader(sheet: ExcelJS.Worksheet, grid: boolean): void {
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: grid }];
}

/** Hàng tiêu đề bảng dữ liệu (spec §6.3): nền thương hiệu, chữ trắng đậm, canh trái. */
export function headerRow(sheet: ExcelJS.Worksheet, labels: readonly string[]): void {
  const row = sheet.getRow(1);
  labels.forEach((label, index) => {
    const cell = row.getCell(index + 1);
    cell.value = label;
    cell.font = bodyFont({ size: 10, bold: true, color: { argb: WHITE } });
    cell.fill = fill(BRAND);
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  });
  row.height = 22;
}

/** Sọc xen kẽ: hàng dữ liệu thứ hai, thứ tư… (`index` lẻ, đếm từ 0) nền `BAND`. */
export function stripe(row: ExcelJS.Row, columns: number, index: number): void {
  if (index % 2 === 0) return;
  for (let column = 1; column <= columns; column += 1) row.getCell(column).fill = fill(BAND);
}

/** Metadata của workbook (spec §6.1); bật tính lại công thức khi mở (REPT, SUBTOTAL, SUM). */
export function stampWorkbook(
  book: ExcelJS.Workbook,
  { title, subject, created }: { title: string; subject: string; created: Date },
): void {
  const f = messages.admin.exportFile;
  book.creator = f.backOffice;
  book.lastModifiedBy = f.backOffice;
  book.company = f.company;
  book.title = xmlText(title);
  // Tóm tắt bộ lọc mang từ khoá admin gõ — cũng đi vào XML của file.
  book.subject = xmlText(subject);
  book.created = created;
  book.modified = created;
  book.calcProperties.fullCalcOnLoad = true;
}

/** Ô mã đơn bấm được, mở trang đơn trong admin (spec §6.3, §7.1); chữ Consolas như mọi mã. */
export function bookingLink(cell: ExcelJS.Cell, code: string, adminOrigin: string): void {
  cell.value = {
    text: code,
    hyperlink: `${adminOrigin}/bookings/${encodeURIComponent(code)}`,
    tooltip: messages.admin.exportFile.openBooking,
  };
  cell.font = { name: MONO_FONT, size: 10, color: { argb: BRAND }, underline: true };
}

export interface SubtotalColumn {
  column: number;
  result: number;
  numFmt: string;
}

/**
 * Hàng Total ngay dưới bảng: `SUBTOTAL(109, …)` tự đổi theo bộ lọc (ADR-0034 AMEND 3 mục 3); viền
 * trên mực đậm. Bảng trống (`last < first`) thì không có hàng tổng.
 */
export function subtotalRow(
  sheet: ExcelJS.Worksheet,
  label: string,
  { first, last }: { first: number; last: number },
  width: number,
  columns: readonly SubtotalColumn[],
): void {
  if (last < first) return;
  const row = sheet.getRow(last + 1);
  row.getCell(1).value = label;
  row.getCell(1).font = bodyFont({ size: 10, bold: true });
  for (const { column, result, numFmt } of columns) {
    const cell = row.getCell(column);
    const letter = sheet.getColumn(column).letter;
    cell.value = { formula: `SUBTOTAL(109,${letter}${first}:${letter}${last})`, result };
    cell.numFmt = numFmt;
    cell.font = bodyFont({ name: MONO_FONT, size: 10, bold: true });
  }
  for (let column = 1; column <= width; column += 1)
    row.getCell(column).border = { top: thin(INK) };
}
