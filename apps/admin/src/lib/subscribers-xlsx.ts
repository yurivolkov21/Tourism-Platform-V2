import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { formatCalendarDate, formatDateRange } from './bookings-view';
import type { SubscribersQuery } from './subscribers-query';
import {
  addSheet,
  bodyFont,
  cellText,
  DIM,
  dateTime,
  freezeHeader,
  headerRow,
  printFrame,
  stampWorkbook,
  stripe,
} from './xlsx-style';

/**
 * File Excel của `/subscribers/export` (G40, ADR-0034 AMEND 3 — thay `subscribers-csv.ts`). Danh sách
 * LIÊN LẠC, không phải bản sao lưu: không có `id`. Nguồn ghi nguyên văn (vắng là ô trống); trạng thái
 * là nhãn của bảng; mốc là ngày-giờ theo giờ Việt Nam.
 */
const l = messages.admin.subscribers.list;
const x = messages.admin.subscribers.xlsx;
const c = x.columns;

export const SUBSCRIBERS_XLSX_HEADER: readonly string[] = [
  c.email,
  c.source,
  c.status,
  c.subscribedAt,
  c.confirmedAt,
  c.unsubscribedAt,
];

/**
 * Đủ cho nhãn tiêu đề đậm có thụt lề cộng nút lọc (đo bằng Excel 16): AutoFit chỉ đo chữ, ba cột
 * "… (Vietnam time)" cần 27–29 cho chữ và thêm một đơn vị cho nút — cùng 31 cho đều.
 */
const WIDTHS = [34, 18, 24, 31, 31, 31];

/**
 * Trạng thái của một địa chỉ: đã rút consent thắng mọi thứ; chưa bấm link xác nhận (double opt-in,
 * W4 E3) là "Awaiting confirmation"; còn lại đang nhận tin.
 */
export function subscriberStatus(
  row: Pick<SubscriberRow, 'confirmedAt' | 'unsubscribedAt'>,
): string {
  if (row.unsubscribedAt !== null) return l.unsubscribed;
  return row.confirmedAt === null ? l.awaitingConfirmation : l.active;
}

/**
 * Tóm tắt bộ lọc cho đầu trang khi in: tab · khoảng ngày · số hàng chọn · nguồn · từ khoá. Tab Active gọi
 * là "Active and awaiting confirmation" — cột Status chỉ gọi "Active" địa chỉ đã xác nhận, một file không
 * dùng một chữ cho hai tập.
 *
 * Khoảng ngày (G43) là ngày UTC như bảng trên màn hình, tách CHUỖI (`formatCalendarDate`) nên không trôi
 * múi giờ. Số hàng chọn đứng TRƯỚC nguồn và từ khoá, khác thứ tự file bookings: riêng chữ của tab đã dài
 * 32 ký tự, còn nguồn và từ khoá là chữ tự do (tới 40 và 120 ký tự), nên đứng sau chúng thì "n selected
 * rows" là phần đầu tiên bị cắt khi đầu trang chạm trần — tờ in sẽ nói đó là cả tập.
 */
export function subscribersFilterSummary(query: SubscribersQuery, selected: number): string {
  const parts: string[] = [
    query.active === undefined ? l.all : query.active ? x.activeTab : l.unsubscribed,
  ];
  if (query.from && query.to) parts.push(x.utcDates(formatDateRange(query.from, query.to)));
  else if (query.from) parts.push(x.utcDates(x.dateFrom(formatCalendarDate(query.from))));
  else if (query.to) parts.push(x.utcDates(x.dateUntil(formatCalendarDate(query.to))));
  if (selected > 0) parts.push(x.selected(selected));
  if (query.source) parts.push(x.source(query.source));
  if (query.search) parts.push(x.search(query.search));
  return parts.join(' · ');
}

export async function buildSubscribersWorkbook(
  rows: readonly SubscriberRow[],
  {
    query,
    selected,
    generatedAt,
  }: { query: SubscribersQuery; selected: number; generatedAt: string },
): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const summary = subscribersFilterSummary(query, selected);
  stampWorkbook(book, { title: x.docTitle, subject: summary, created: new Date(generatedAt) });
  // Khổ ngang như file bookings (spec §7.2 "cùng kiểu sheet"): khổ dọc thu bảng còn ~70% khi in.
  const sheet = addSheet(book, x.sheet, {
    tab: DIM,
    grid: true,
    landscape: true,
    frame: printFrame(x.headerCenter(summary), generatedAt),
  });
  sheet.columns = WIDTHS.map((width) => ({ width }));
  headerRow(sheet, SUBSCRIBERS_XLSX_HEADER);
  const columns = SUBSCRIBERS_XLSX_HEADER.length;

  rows.forEach((subscriber, index) => {
    const row = sheet.getRow(2 + index);
    // Email và nguồn là chữ người lạ nhập qua form đăng ký công khai (`cellText`).
    row.getCell(1).value = cellText(subscriber.email);
    if (subscriber.source !== null) row.getCell(2).value = cellText(subscriber.source);
    row.getCell(3).value = subscriberStatus(subscriber);
    dateTime(row.getCell(4), subscriber.createdAt);
    dateTime(row.getCell(5), subscriber.confirmedAt);
    dateTime(row.getCell(6), subscriber.unsubscribedAt);
    for (let column = 1; column <= columns; column += 1) {
      row.getCell(column).font = bodyFont({ size: 10 });
    }
    stripe(row, columns, index);
  });

  freezeHeader(sheet, true);
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, rows.length + 1), column: columns } };
  sheet.pageSetup.printTitlesRow = '1:1';
  return (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
