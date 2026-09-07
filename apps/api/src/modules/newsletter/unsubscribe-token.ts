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
  return timingSafeCompare(expected, token);
}

// ─────────────────────────────────────────────────────────────────────────────
// W4 E4 (ADR-0039 §3): token v1 có MỤC ĐÍCH + PHIÊN BẢN. v0 ở trên là HMAC
// trần của riêng subscriberId — MỘT chuỗi mở được mọi cửa (unsubscribe =
// resubscribe = confirm); v1 ký `<id>.<purpose>` nên mỗi mục đích một chữ ký.
// ─────────────────────────────────────────────────────────────────────────────

export type NewsletterTokenPurpose = 'unsubscribe' | 'confirm' | 'resubscribe';

/**
 * Hạn của token resubscribe — 30 ngày (ADR-0039 §3): quyền "đăng ký lại
 * không qua double opt-in" không được sống vĩnh viễn trong một hộp thư có
 * thể bị bán lại. `unsubscribe`/`confirm` KHÔNG hết hạn (huỷ đăng ký phải
 * luôn chạy; confirm hết hạn chỉ tạo ngõ cụt).
 */
export const RESUBSCRIBE_TOKEN_TTL_MS = 30 * 86_400_000;

/** HMAC-SHA256 hex của một chuỗi payload bất kỳ, ký bằng `secret`. */
function hmacOf(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Sinh token v1: `v1.<purpose>.<hmac>`; riêng resubscribe chèn exp (epoch
 * GIÂY) thành `v1.resubscribe.<exp>.<hmac>` — exp nằm TRONG phần ký nên sửa
 * tay là chữ ký lệch. `now` nhận qua tham số để test không đợi 30 ngày.
 */
export function makeNewsletterToken(
  subscriberId: string,
  purpose: NewsletterTokenPurpose,
  secret: string,
  now: Date = new Date(),
): string {
  if (purpose === 'resubscribe') {
    const exp = Math.floor((now.getTime() + RESUBSCRIBE_TOKEN_TTL_MS) / 1000);
    return `v1.resubscribe.${exp}.${hmacOf(`${subscriberId}.resubscribe.${exp}`, secret)}`;
  }
  return `v1.${purpose}.${hmacOf(`${subscriberId}.${purpose}`, secret)}`;
}

/**
 * Verify token cho MỘT purpose cụ thể. Không bao giờ throw — token rác/
 * version lạ/thiếu segment chỉ trả `false` (cùng hợp đồng với v0 ở trên).
 *
 * Tương thích lùi: token KHÔNG có tiền tố `v1.` được coi là v0 và CHỈ được
 * nhận cho `unsubscribe` — mọi email đã gửi trước W4 in token dạng đó, link
 * huỷ trong hộp thư khách phải còn chạy. Ngày ngừng nhận: 31/12/2026
 * (ADR-0039 §3) — sau đó gỡ nhánh này bằng một commit có chủ đích.
 */
export function verifyNewsletterToken(
  subscriberId: string,
  token: string,
  purpose: NewsletterTokenPurpose,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (!token.startsWith('v1.')) {
    // Nhánh v0 — xem JSDoc: chỉ unsubscribe, tới 31/12/2026.
    return purpose === 'unsubscribe' && verifyUnsubscribeToken(subscriberId, token, secret);
  }
  const parts = token.split('.');
  if (purpose === 'resubscribe') {
    if (parts.length !== 4 || parts[1] !== 'resubscribe') return false;
    const exp = Number(parts[2]);
    if (!Number.isInteger(exp)) return false;
    const expected = `v1.resubscribe.${exp}.${hmacOf(`${subscriberId}.resubscribe.${exp}`, secret)}`;
    // So chữ ký TRƯỚC, hết-hạn SAU: một exp bịa không bao giờ tới được nhánh
    // "còn hạn" vì chữ ký ký cả exp.
    if (!timingSafeCompare(expected, token)) return false;
    return exp * 1000 > now.getTime();
  }
  if (parts.length !== 3 || parts[1] !== purpose) return false;
  const expected = `v1.${purpose}.${hmacOf(`${subscriberId}.${purpose}`, secret)}`;
  return timingSafeCompare(expected, token);
}

/**
 * So sánh timing-safe: `===` rò rỉ độ dài tiền tố khớp qua thời gian chạy,
 * đủ để dò ra token hợp lệ nếu kiên nhẫn (side-channel timing attack).
 * Lệch độ dài trả false ngay — timingSafeEqual ném lỗi nếu lệch.
 */
function timingSafeCompare(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
