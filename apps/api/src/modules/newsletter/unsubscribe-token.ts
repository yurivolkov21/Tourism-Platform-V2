import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256(subscriberId) ký bằng `NEWSLETTER_UNSUBSCRIBE_SECRET` (spec
 * §4.4). Tự xác thực — không cần lưu token vào DB, verify lại được bất cứ lúc
 * nào chỉ từ (id, secret). Đổi lại: không revoke được TỪNG token riêng lẻ,
 * chỉ revoke HÀNG LOẠT bằng cách xoay secret (chấp nhận được — link huỷ đăng
 * ký không có khái niệm "hết hạn theo phiên" như session token).
 */
export function makeUnsubscribeToken(subscriberId: string, secret: string): string {
  return createHmac('sha256', secret).update(subscriberId).digest('hex');
}

/**
 * So khớp token với (subscriberId, secret). Không bao giờ throw — token rác
 * (không phải hex, sai độ dài, rỗng) chỉ trả `false`, để caller ở biên HTTP
 * luôn map được thẳng sang một lỗi 400 duy nhất (`INVALID_UNSUBSCRIBE_TOKEN`)
 * mà không cần try/catch riêng cho lớp lỗi "token dị dạng".
 */
export function verifyUnsubscribeToken(
  subscriberId: string,
  token: string,
  secret: string,
): boolean {
  const expected = makeUnsubscribeToken(subscriberId, secret);
  // So sánh timing-safe: `===` rò rỉ độ dài tiền tố khớp qua thời gian chạy,
  // đủ để dò ra token hợp lệ nếu kiên nhẫn (side-channel timing attack).
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false; // timingSafeEqual ném lỗi nếu lệch độ dài
  return timingSafeEqual(a, b);
}
