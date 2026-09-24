/**
 * Next 16 trả `string[]` khi một khoá lặp lại trên URL (`?a=1&a=2`), `string`
 * khi có một lần, `undefined` khi vắng. Trang nào đọc `searchParams` phải chuẩn
 * hoá ở biên trước khi đưa xuống code chỉ biết `string` — trang /tours từng
 * khai kiểu `string` rồi gọi thẳng `.split(',')`, và một URL gõ tay làm sập
 * cả trang (vòng review F15).
 */
export type RawSearchParam = string | string[] | undefined;

/** Tham số dạng danh sách ngăn bằng dấu phẩy: khoá lặp lại thì nối lại, không mất giá trị nào. */
export function listParam(value: RawSearchParam): string | undefined {
  return Array.isArray(value) ? value.join(',') : value;
}

/** Tham số một giá trị: khoá lặp lại thì lấy giá trị đầu. */
export function singleParam(value: RawSearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
