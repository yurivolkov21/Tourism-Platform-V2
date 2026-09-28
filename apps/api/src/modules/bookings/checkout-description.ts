/**
 * Dòng mô tả của một lượt thanh toán — "Tên tour (ngày đi – ngày về)" — gửi
 * cho cả hai cổng.
 *
 * Trần 127 là của PayPal Orders v2 (`purchase_units[].description`, "127
 * single-byte characters"), cổng chặt nhất trong hai: dài hơn là PayPal trả
 * 400, khách nhận `CHECKOUT_FAILED` mỗi lần chọn PayPal, và `reCheckout` dựng
 * lại đúng chuỗi ấy nên hỏng lại. Tên tour tới 160 ký tự (vòng review F17), nên
 * phải cắt.
 *
 * Đo bằng BYTE UTF-8 chứ không bằng `length`: tên có dấu tiếng Việt và gạch
 * nối "–" đều nhiều byte, mà "single-byte" nghĩa là cổng đếm theo byte. Cắt ở
 * PHẦN TÊN, giữ nguyên khoảng ngày — ngày là thứ khách cần để nhận ra mình
 * đang trả cho chuyến nào.
 */
const MAX_BYTES = 127;
const ELLIPSIS = '…';
const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

export function checkoutDescription(tourTitle: string, startDate: string, endDate: string): string {
  const range = ` (${startDate} – ${endDate})`;
  const full = `${tourTitle}${range}`;
  if (byteLength(full) <= MAX_BYTES) return full;

  const budget = MAX_BYTES - byteLength(range) - byteLength(ELLIPSIS);
  let head = '';
  // `for…of` đi theo code point: không bao giờ cắt đôi một ký tự nhiều byte.
  for (const char of tourTitle) {
    if (byteLength(head + char) > budget) break;
    head += char;
  }
  return `${head.trimEnd()}${ELLIPSIS}${range}`;
}
