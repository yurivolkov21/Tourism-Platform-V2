import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import type { BookingsQuery } from './bookings-query';
import { formatCalendarDate, formatDateRange, guestCount, statusLabel } from './bookings-view';
import {
  addSheet,
  bodyFont,
  bookingLink,
  COST,
  COUNT_FMT,
  calendarDate,
  count,
  DATE_FMT,
  DATETIME_FMT,
  DIM,
  freezeHeader,
  headerRow,
  INK,
  MONEY_FMT,
  MONO_FONT,
  money,
  printFrame,
  stampWorkbook,
  stripe,
  subtotalRow,
  sumMoney,
  vietnamDateTime,
} from './xlsx-style';

/**
 * File Excel của `/bookings/export` (G40, ADR-0034 AMEND 3 — thay `bookings-csv.ts`). THUẦN: nhận
 * booking, trả `ArrayBuffer`. Mỗi ô mang KIỂU thật — tiền là số, ngày là ngày, mốc thời gian là
 * ngày-giờ theo giờ Việt Nam — nên file mở đúng bằng bấm đúp ở mọi máy (CSV dồn một cột trên Windows
 * tiếng Việt, đo 10/10).
 *
 * Không còn khâu chống "CSV injection": ô chữ của `.xlsx` lưu kiểu chuỗi, Excel không bao giờ chạy nó
 * như công thức — chỉ ô `{ formula }` mới là công thức.
 */
const x = messages.admin.bookings.xlsx;
const c = x.columns;

export const BOOKINGS_XLSX_HEADER: readonly string[] = [
  c.code,
  c.status,
  c.tour,
  c.departureStart,
  c.departureEnd,
  c.adults,
  c.children,
  c.guests,
  c.unitPrice,
  c.total,
  c.refunded,
  c.currency,
  c.customer,
  c.email,
  c.phone,
  c.bookedAt,
  c.paidAt,
  c.cancelledAt,
];

/** Độ rộng 18 cột, cùng thứ tự `BOOKINGS_XLSX_HEADER`. */
const WIDTHS = [16, 18, 36, 14, 14, 9, 9, 9, 14, 13, 13, 10, 22, 30, 18, 20, 20, 20];

/**
 * Tóm tắt bộ lọc cho đầu trang khi in (spec §7.1): trạng thái · khoảng ngày · từ khoá · số hàng chọn,
 * hoặc "All bookings". Ngày tách CHUỖI (`formatCalendarDate`), không qua `Date` — không trôi múi giờ.
 */
export function bookingsFilterSummary(query: BookingsQuery, selected: number): string {
  const parts: string[] = [];
  if (query.status) parts.push(statusLabel(query.status));
  if (query.from && query.to) parts.push(formatDateRange(query.from, query.to));
  else if (query.from) parts.push(x.dateFrom(formatCalendarDate(query.from)));
  else if (query.to) parts.push(x.dateUntil(formatCalendarDate(query.to)));
  if (query.search) parts.push(x.search(query.search));
  if (selected > 0) parts.push(x.selected(selected));
  return parts.length === 0 ? x.allBookings : parts.join(' · ');
}

/** Ô ngày-giờ theo giờ Việt Nam, hoặc để TRỐNG khi mốc vắng — ô trống là "không có giá trị". */
function vietnamTime(cell: ExcelJS.Cell, iso: string | null): void {
  if (iso === null) return;
  cell.value = vietnamDateTime(iso);
  cell.numFmt = DATETIME_FMT;
}

export async function buildBookingsWorkbook(
  bookings: readonly Booking[],
  {
    query,
    selected,
    adminOrigin,
    generatedAt,
  }: { query: BookingsQuery; selected: number; adminOrigin: string; generatedAt: string },
): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const summary = bookingsFilterSummary(query, selected);
  stampWorkbook(book, { title: x.docTitle, subject: summary, created: new Date(generatedAt) });
  const sheet = addSheet(book, x.sheet, {
    tab: DIM,
    grid: true,
    landscape: true,
    frame: printFrame(x.headerCenter(summary), generatedAt),
  });
  sheet.columns = WIDTHS.map((width) => ({ width }));
  headerRow(sheet, BOOKINGS_XLSX_HEADER);
  const columns = BOOKINGS_XLSX_HEADER.length;

  const first = 2;
  bookings.forEach((booking, index) => {
    const row = sheet.getRow(first + index);
    bookingLink(row.getCell(1), booking.code, adminOrigin);
    row.getCell(2).value = statusLabel(booking.status);
    row.getCell(3).value = booking.tourTitle;
    row.getCell(4).value = calendarDate(booking.departureStartDate);
    row.getCell(5).value = calendarDate(booking.departureEndDate);
    count(row.getCell(6), booking.numAdults);
    count(row.getCell(7), booking.numChildren);
    count(row.getCell(8), guestCount(booking));
    money(row.getCell(9), booking.unitPrice);
    money(row.getCell(10), booking.totalAmount);
    money(row.getCell(11), booking.refundedTotal);
    row.getCell(12).value = booking.currency;
    row.getCell(13).value = booking.contactName;
    row.getCell(14).value = booking.contactEmail;
    if (booking.contactPhone !== null) row.getCell(15).value = booking.contactPhone;
    vietnamTime(row.getCell(16), booking.createdAt);
    vietnamTime(row.getCell(17), booking.paidAt);
    vietnamTime(row.getCell(18), booking.cancelledAt);

    for (let column = 2; column <= columns; column += 1) {
      const numeric = column >= 6 && column <= 11;
      row.getCell(column).font = bodyFont({
        size: 10,
        ...(numeric ? { name: MONO_FONT } : {}),
        color: { argb: column === 2 && booking.status === 'CANCELLED' ? COST : INK },
      });
    }
    row.getCell(4).numFmt = DATE_FMT;
    row.getCell(5).numFmt = DATE_FMT;
    stripe(row, columns, index);
  });

  const last = first + bookings.length - 1;
  subtotalRow(sheet, x.total, { first, last }, columns, [
    { column: 8, result: bookings.reduce((sum, b) => sum + guestCount(b), 0), numFmt: COUNT_FMT },
    { column: 10, result: sumMoney(bookings.map((b) => b.totalAmount)), numFmt: MONEY_FMT },
    { column: 11, result: sumMoney(bookings.map((b) => b.refundedTotal)), numFmt: MONEY_FMT },
  ]);

  freezeHeader(sheet, true);
  // Lọc tới hàng DỮ LIỆU cuối, không gồm hàng Total (sắp xếp sẽ kéo nó lên giữa bảng).
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, last), column: columns } };
  sheet.pageSetup.printTitlesRow = '1:1';

  // Kiểu `Buffer` riêng của ExcelJS — xem `buildReportWorkbook`.
  return (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
