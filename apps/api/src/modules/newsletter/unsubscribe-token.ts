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

/**
 * Ngày NGỪNG NHẬN token v0 (ADR-0039 §3, vòng vá review W4): từ mốc này nhánh
 * v0 trong `verifyNewsletterToken` trả false — hằng số sống trong code chứ
 * không chỉ ở JSDoc, để "ngày ngừng nhận" là thứ máy thi hành. Sau mốc, gỡ
 * hẳn nhánh v0 bằng một commit có chủ đích.
 */
export const V0_ACCEPT_UNTIL = new Date('2027-01-01T00:00:00Z');

/**
 * "Thế hệ consent" dùng để KHOÁ token `confirm` vào đúng lượt xin đăng ký
 * (vòng vá review W4): token confirm không hết hạn, nên một thư xác nhận cũ
 * (forward đi nơi khác) mà còn bật lại được consent SAU khi khách đã huỷ là
 * lỗ — ký thêm mốc `unsubscribedAt` hiện tại vào payload thì mọi token mint
 * trước lần huỷ chết ngay lúc huỷ, còn thư xác nhận mới (gửi khi khách tự
 * điền lại form) mang thế hệ mới và mở được. Row chưa từng huỷ → `initial`.
 */
export function consentGeneration(subscriber: { unsubscribedAt: Date | null }): string {
  return subscriber.unsubscribedAt ? String(subscriber.unsubscribedAt.getTime()) : 'initial';
}

/** HMAC-SHA256 hex của một chuỗi payload bất kỳ, ký bằng `secret`. */
function hmacOf(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Sinh token v1: `v1.<purpose>.<hmac>`; riêng resubscribe chèn exp (epoch
 * GIÂY) thành `v1.resubscribe.<exp>.<hmac>` — exp nằm TRONG phần ký nên sửa
 * tay là chữ ký lệch. `now` nhận qua tham số để test không đợi 30 ngày.
 * `generation` (chỉ có nghĩa cho `confirm`, xem {@link consentGeneration})
 * nằm trong phần ký nhưng KHÔNG in ra token — verifier lấy nó từ row DB.
 */
export function makeNewsletterToken(
  subscriberId: string,
  purpose: NewsletterTokenPurpose,
  secret: string,
  now: Date = new Date(),
  generation = '',
): string {
  if (purpose === 'resubscribe') {
    const exp = Math.floor((now.getTime() + RESUBSCRIBE_TOKEN_TTL_MS) / 1000);
    return `v1.resubscribe.${exp}.${hmacOf(`${subscriberId}.resubscribe.${exp}`, secret)}`;
  }
  return `v1.${purpose}.${hmacOf(signedPayload(subscriberId, purpose, generation), secret)}`;
}

/** Payload ký của token không-exp: thêm `.<generation>` khi có. */
function signedPayload(subscriberId: string, purpose: string, generation: string): string {
  return generation === ''
    ? `${subscriberId}.${purpose}`
    : `${subscriberId}.${purpose}.${generation}`;
}

/**
 * Verify token cho MỘT purpose cụ thể. Không bao giờ throw — token rác/
 * version lạ/thiếu segment chỉ trả `false` (cùng hợp đồng với v0 ở trên).
 *
 * Tương thích lùi: token KHÔNG có tiền tố `v1.` được coi là v0 và CHỈ được
 * nhận cho `unsubscribe` — mọi email đã gửi trước W4 in token dạng đó, link
 * huỷ trong hộp thư khách phải còn chạy. Ngừng nhận từ {@link V0_ACCEPT_UNTIL}
 * (ADR-0039 §3) — máy thi hành, sau đó gỡ nhánh này bằng một commit có chủ đích.
 */
export function verifyNewsletterToken(
  subscriberId: string,
  token: string,
  purpose: NewsletterTokenPurpose,
  secret: string,
  now: Date = new Date(),
  generation = '',
): boolean {
  if (!token.startsWith('v1.')) {
    // Nhánh v0 — xem JSDoc: chỉ unsubscribe, chỉ trước V0_ACCEPT_UNTIL.
    return (
      purpose === 'unsubscribe' &&
      now < V0_ACCEPT_UNTIL &&
      verifyUnsubscribeToken(subscriberId, token, secret)
    );
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
  const expected = `v1.${purpose}.${hmacOf(signedPayload(subscriberId, purpose, generation), secret)}`;
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
