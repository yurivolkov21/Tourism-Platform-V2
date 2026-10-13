/**
 * Phần chung của cú xuất THEO HÀNG ĐÃ TÍCH: `/bookings/export` (spec 01/09) và
 * `/subscribers/export` (G43, 13/10). Lên kit khi có vùng thứ hai, cùng lý do với
 * `resolvePagePatch`: luật "thiếu một hàng là từ chối" chỉ được có MỘT bản.
 */

/**
 * Tên tham số mang danh sách khoá đã tích. Route export và bên dựng URL đọc CÙNG MỘT
 * chuỗi — gõ tay hai lần là hai bản trôi lệch trong im lặng, và triệu chứng sẽ là
 * "bấm Export mà vẫn ra cả tập".
 */
export const EXPORT_SELECTION_PARAM = 'sel';

/**
 * Khoá đã tích trên URL: tách dấu phẩy, bỏ khoảng trắng và mục rỗng. Vắng hay rỗng là
 * `[]`, tức xuất cả tập — `sel=` trống không được rẽ route sang nhánh "có chọn" rồi trả
 * 409 cho thứ admin không hề làm.
 */
export function parseExportSelection(params: URLSearchParams): string[] {
  return (params.get(EXPORT_SELECTION_PARAM) ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

/**
 * Các hàng của trang có khoá nằm trong `selected`, theo thứ tự của trang.
 *
 * Thiếu BẤT KỲ khoá nào thì trả `null` và route trả 409: trang đã đổi dưới chân admin
 * (hàng rơi khỏi bộ lọc, hàng mới chen vào đẩy hàng cũ sang trang sau). Giao một file ít
 * dòng hơn số hàng đã tích là NÓI DỐI — người tải tưởng mình có đủ — cùng lý do nhánh
 * xuất cả tập từ chối bằng 413 thay vì cắt bớt (vòng vá review 02/09 của `/bookings`).
 * So với số khoá KHÁC NHAU: khoá lặp trên URL không được tính là hai hàng.
 */
export function pickSelectedRows<T>(
  items: readonly T[],
  selected: readonly string[],
  keyOf: (item: T) => string,
): T[] | null {
  const wanted = new Set(selected);
  const rows = items.filter((item) => wanted.has(keyOf(item)));
  return rows.length === wanted.size ? rows : null;
}
