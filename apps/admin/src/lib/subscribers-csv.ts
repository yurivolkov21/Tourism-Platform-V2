import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * Subscriber → hàng CSV (spec P4c §3-F10). THUẦN, nằm ngoài route handler nên
 * từng cột test được mà không cần dựng một request. Phần escape (chống CSV
 * injection + bọc theo RFC 4180) là việc của `csv.ts` dùng chung.
 *
 * Vì sao KHÔNG dùng lại `toSubscriberRowVM` (mapper của bảng): hai đích khác
 * nhau, đúng lý do đã ghi ở `bookings-csv.ts`. Bảng nấu cho MẮT NGƯỜI —
 * "1 Sep 2026, 10:00 UTC", "Direct sign-up", "Still subscribed". File nấu cho
 * CÔNG CỤ — người mở nó sẽ lọc theo ngày, sắp xếp, dựng pivot, nên mốc phải
 * là ISO nguyên văn và ô vắng phải RỖNG. Một ô ghi "Still subscribed" trong
 * cột ngày là một cột không sắp xếp được nữa; ô rỗng thì mọi công cụ đều
 * hiểu là "không có giá trị".
 *
 * ĐÚNG bốn cột (spec §3-F10), không có `id`: file này là danh sách LIÊN LẠC
 * để nhập vào một công cụ gửi thư, không phải bản sao lưu của bảng — uuid
 * nội bộ không nói gì với công cụ nào ngoài đây.
 */

const t = messages.admin.subscribers.csv;

/** Thứ tự cột — hàng dữ liệu bên dưới PHẢI xếp đúng thứ tự này. */
export const SUBSCRIBERS_CSV_HEADER: readonly string[] = [
  t.email,
  t.source,
  t.subscribedAt,
  t.unsubscribedAt,
];

/** Một địa chỉ → một hàng, cùng thứ tự với `SUBSCRIBERS_CSV_HEADER`. */
export function toSubscriberCsvRow(row: SubscriberRow): string[] {
  return [row.email, row.source ?? '', row.createdAt, row.unsubscribedAt ?? ''];
}

/**
 * Cả bảng CSV: header + một hàng mỗi địa chỉ. Tập rỗng vẫn giữ header — file
 * tải về mở ra thấy tên cột nói rõ "bộ lọc này không có ai", khác hẳn một file
 * trắng trông như hỏng.
 */
export function subscribersCsvRows(rows: readonly SubscriberRow[]): string[][] {
  return [[...SUBSCRIBERS_CSV_HEADER], ...rows.map(toSubscriberCsvRow)];
}
