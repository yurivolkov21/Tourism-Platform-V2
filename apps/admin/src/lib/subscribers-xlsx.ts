import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import type { SubscribersQuery } from './subscribers-query';
import {
  addSheet,
  bodyFont,
  DATETIME_FMT,
  DIM,
  freezeHeader,
  headerRow,
  printFrame,
  stampWorkbook,
  stripe,
  vietnamDateTime,
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

const WIDTHS = [34, 18, 22, 22, 22, 22];

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

/** Tóm tắt bộ lọc cho đầu trang khi in: tab (Active · Unsubscribed · All) · nguồn · từ khoá. */
export function subscribersFilterSummary(query: SubscribersQuery): string {
  const parts: string[] = [
    query.active === undefined ? l.all : query.active ? l.active : l.unsubscribed,
  ];
  if (query.source) parts.push(x.source(query.source));
  if (query.search) parts.push(x.search(query.search));
  return parts.join(' · ');
}

function vietnamTime(cell: ExcelJS.Cell, iso: string | null): void {
  if (iso === null) return;
  cell.value = vietnamDateTime(iso);
  cell.numFmt = DATETIME_FMT;
}

export async function buildSubscribersWorkbook(
  rows: readonly SubscriberRow[],
  { query, generatedAt }: { query: SubscribersQuery; generatedAt: string },
): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const summary = subscribersFilterSummary(query);
  stampWorkbook(book, { title: x.docTitle, subject: summary, created: new Date(generatedAt) });
  const sheet = addSheet(book, x.sheet, {
    tab: DIM,
    grid: true,
    frame: printFrame(x.headerCenter(summary), generatedAt),
  });
  sheet.columns = WIDTHS.map((width) => ({ width }));
  headerRow(sheet, SUBSCRIBERS_XLSX_HEADER);
  const columns = SUBSCRIBERS_XLSX_HEADER.length;

  rows.forEach((subscriber, index) => {
    const row = sheet.getRow(2 + index);
    row.getCell(1).value = subscriber.email;
    if (subscriber.source !== null) row.getCell(2).value = subscriber.source;
    row.getCell(3).value = subscriberStatus(subscriber);
    vietnamTime(row.getCell(4), subscriber.createdAt);
    vietnamTime(row.getCell(5), subscriber.confirmedAt);
    vietnamTime(row.getCell(6), subscriber.unsubscribedAt);
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
