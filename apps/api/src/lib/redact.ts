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

/**
 * Hậu tố khoá coi là bí mật (W4 E7, ADR-0039 §5) — CHỈ áp khi dùng tập khoá
 * mặc định: `unsubscribeToken`, `confirmToken`, `clientSecret`,
 * `webhookSecret`, `userPassword`… tự được che mà không phải nhớ thêm vào
 * danh sách. Hậu tố chứ không chuỗi-con: `tokenCount`/`secret_reason` là dữ
 * liệu thường, che nhầm là admin mất khả năng đọc payload.
 */
const SECRET_KEY_SUFFIXES = ['token', 'secret', 'password'] as const;

/**
 * Khoá này có phải bí mật không — so KHÔNG phân biệt hoa/thường (W4 E7:
 * `Token`/`URL`/`clientSecret` cùng bị che như bản lowercase). Tập khoá tuỳ
 * chọn (khác mặc định) là caller nhận toàn quyền: chỉ so bằng, KHÔNG áp luật
 * hậu tố — test "tập khoá tuỳ chọn thay được mặc định" ghim hợp đồng đó.
 */
function isSecretKey(key: string, keys: ReadonlySet<string>): boolean {
  const lowered = key.toLowerCase();
  if (keys.has(lowered)) return true;
  if (keys !== SECRET_KEYS) return false;
  return SECRET_KEY_SUFFIXES.some((suffix) => lowered.endsWith(suffix));
}

/** Che đệ quy; vô hướng/null đi qua nguyên vẹn. `keys` mặc định `SECRET_KEYS`. */
export function redactDeep(value: unknown, keys: ReadonlySet<string> = SECRET_KEYS): unknown {
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, keys));
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = Object.create(null);
  for (const [key, child] of Object.entries(value)) {
    out[key] = isSecretKey(key, keys) ? REDACTED : redactDeep(child, keys);
  }
  return out;
}
