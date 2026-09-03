/**
 * Escape ký tự đại diện của `LIKE`/`ILIKE` trong chuỗi NGƯỜI DÙNG gõ.
 *
 * Prisma `contains`/`startsWith` KHÔNG tự escape `%` và `_` (doc Prisma:
 * muốn khớp `_` phải tự viết `\_`) — vòng vá review F9: dán email
 * `john_doe@…` vào ô tìm thì `_` thành wildcard một ký tự và bảng kéo về cả
 * `johnXdoe@…`; gõ `%` thì trả TOÀN BỘ bảng trong khi ô tìm nói đang lọc.
 * Postgres mặc định escape bằng `\`, nên `\` trong input cũng phải nhân đôi
 * trước — thứ tự thay thế ở dưới là có chủ đích.
 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
