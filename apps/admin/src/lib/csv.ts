/**
 * Dựng CSV cho các nút export của admin (spec P4b §3-F6). THUẦN — không đụng
 * React, không đụng fetch — nên mọi nhánh escape được test mà không cần chạy
 * route handler nào.
 *
 * Đường 0-dependency là quyết định của user (31/08, freeze dep 15/10): không
 * thêm thư viện xlsx/PDF. CSV + trang in là đủ cho việc admin cần làm (mở
 * bằng Excel/Sheets, hoặc Print → PDF), và phần khó của CSV chỉ là escape —
 * viết đúng một lần ở đây, có test, rẻ hơn một dependency mới.
 *
 * Hai lớp nguy hiểm được xử lý TÁCH BẠCH và theo đúng thứ tự:
 *
 * 1. **CSV injection** — Excel/Sheets đọc ô bắt đầu bằng `=`, `+`, `-`, `@`
 *    (kể cả sau tab/CR) như CÔNG THỨC. Một khách tên `=HYPERLINK(...)` là
 *    code chạy trên máy người mở file. Vô hiệu bằng tiền tố nháy đơn.
 * 2. **Cấu trúc** (RFC 4180) — dấu phẩy, nháy kép, xuống dòng phải được bọc
 *    nháy và nháy bên trong phải nhân đôi.
 *
 * Thứ tự là bắt buộc: vô hiệu công thức TRƯỚC, bọc SAU. Làm ngược lại thì giá
 * trị đã bọc không còn "bắt đầu bằng `=`" nữa và bước 1 trượt hết.
 */

/**
 * BOM UTF-8. Excel trên Windows đoán bảng mã theo locale khi không có nó —
 * "Hội An" ra ký tự rác. Ba byte này là giá của việc file mở đúng ngay lần đầu.
 */
export const CSV_BOM = '﻿';

/** Content-Type kèm charset — trình duyệt/Excel không phải đoán. */
export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

/** RFC 4180 dùng CRLF; Excel cũng vui vẻ nhất với nó. */
const ROW_SEPARATOR = '\r\n';

/** Ký tự mở đầu bị Excel/Sheets hiểu là công thức. */
const FORMULA_STARTERS = ['=', '+', '-', '@'];

/** Ký tự vô hình mà Excel bỏ qua trước khi đọc tiếp — vẫn là đường tiêm. */
const INVISIBLE_LEADERS = ['\t', '\r'];

/** Ký tự buộc phải bọc nháy vì chúng phá cấu trúc hàng/cột. */
const NEEDS_QUOTING = [',', '"', '\n', '\r'];

/** Một ô đã an toàn để ghép vào hàng CSV. */
export function escapeCsvValue(value: string): string {
  // Bước 1: vô hiệu công thức. Ký tự đầu tiên NHÌN THẤY được mới đáng kể —
  // Excel bỏ qua tab/CR đứng trước rồi mới đọc, nên tiền tố phải đặt ở ngoài
  // cùng chứ không phải sau chúng.
  const firstVisible = value.at(0) ?? '';
  const dangerous =
    FORMULA_STARTERS.includes(firstVisible) ||
    (INVISIBLE_LEADERS.includes(firstVisible) &&
      FORMULA_STARTERS.some((starter) => value.trimStart().startsWith(starter)));
  const defused = dangerous ? `'${value}` : value;

  // Bước 2: bọc theo cấu trúc.
  return NEEDS_QUOTING.some((char) => defused.includes(char))
    ? `"${defused.replaceAll('"', '""')}"`
    : defused;
}

/**
 * Bảng (hàng đầu là header) → thân file CSV. Header KHÔNG được miễn escape:
 * nhãn cột đến từ i18n và một dấu phẩy trong đó cũng làm lệch cả file.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join(ROW_SEPARATOR) + ROW_SEPARATOR;
}

/** File hoàn chỉnh: BOM + thân. Đây là thứ đi vào body của response. */
export function csvDocument(rows: readonly (readonly string[])[]): string {
  return CSV_BOM + toCsv(rows);
}

/**
 * Ngày UTC `YYYY-MM-DD` của một mốc — cùng thước với ngày mà API lọc
 * (`bookings-date-range.ts`), nên tên file nói cùng một ngày với dữ liệu bên
 * trong dù người xuất ngồi ở múi giờ nào.
 */
export function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Tên file tải về. Phần `name` được LÀM SẠCH về `[a-z0-9-]`: nó đi thẳng vào
 * header `Content-Disposition`, nơi một dấu nháy hay xuống dòng lọt vào là
 * một lỗ header injection — không phải chỉ là tên xấu.
 */
export function csvFilename(name: string, day: string): string {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe}-${day}.csv`;
}
