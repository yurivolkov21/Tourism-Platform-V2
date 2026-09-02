/**
 * Che khoá bí mật trong một giá trị JSON — DÙNG CHUNG cho mọi bề mặt admin
 * phơi payload thô (vòng vá review F8: `outbox-row.ts` che tầng ngoài với
 * ba khoá, `payment-event-row.ts` che đệ quy với bảy khoá — hai máy che,
 * hai danh sách, và khoá `token` của bên này không có ở bên kia).
 *
 * Một luật cho cả hai: che theo TÊN khoá ở MỌI độ sâu, kể cả trong mảng.
 * Tên là tập HỢP của hai vùng: loại email/provider mới mang `url`/`otp`/
 * `client_secret`… thì tự được che, không phải nhớ thêm vào danh sách.
 *
 * Object mới được dựng thay vì sửa tại chỗ — payload Prisma trả có thể được
 * đọc lại ở nơi khác. Object đích tạo bằng `Object.create(null)`: payload là
 * JSON của bên ngoài, một khoá `__proto__` trong đó không được phép biến
 * thành prototype của object đang dựng.
 */

export const REDACTED = '[redacted]';

/**
 * Khoá có thể mang credential — hợp của outbox (`url` chứa token reset,
 * `otp`, `token`) và payment events (`client_secret` của PaymentIntent,
 * `access_token`/`refresh_token`/`api_key`/`password`/`secret`).
 */
export const SECRET_KEYS: ReadonlySet<string> = new Set([
  'url',
  'otp',
  'token',
  'client_secret',
  'secret',
  'access_token',
  'refresh_token',
  'api_key',
  'password',
]);

/** Che đệ quy; vô hướng/null đi qua nguyên vẹn. `keys` mặc định `SECRET_KEYS`. */
export function redactDeep(value: unknown, keys: ReadonlySet<string> = SECRET_KEYS): unknown {
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, keys));
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = Object.create(null);
  for (const [key, child] of Object.entries(value)) {
    out[key] = keys.has(key) ? REDACTED : redactDeep(child, keys);
  }
  return out;
}
