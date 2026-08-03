/**
 * Key lỗi auth chuẩn hoá cho tầng UI (Task 3-6 dùng nguyên văn) — i18n copy
 * cho từng key là việc của Task 3, ở đây chỉ phân loại.
 */
export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailExists'
  | 'tooManyRequests'
  | 'invalidOtp'
  | 'invalidToken'
  | 'notAvailable'
  | 'generic';

/**
 * Map lỗi thô từ Better Auth client (shape thực đo được từ
 * @better-fetch/fetch: `{ ...body, status, statusText }` — body server trả
 * về có `code`/`message` dạng UPPER_SNAKE_CASE, xem
 * better-call/src/error.d.ts và @better-auth/core error-codes.ts) sang
 * `AuthErrorKey` ổn định cho UI. Ưu tiên theo thứ tự: status cụ thể trước,
 * rồi tới khớp chuỗi con trong `code`.
 */
export function mapAuthError(
  error: { status?: number; code?: string } | null | undefined,
): AuthErrorKey {
  if (!error) return 'generic';
  const { status, code } = error;

  if (status === 401) return 'invalidCredentials';
  if (status === 422 || code?.includes('EXISTS')) return 'emailExists';
  // OTP sai quá 5 lần — BA throw FORBIDDEN kèm code TOO_MANY_ATTEMPTS (không
  // phải HTTP 429), nên phải khớp theo code chứ không chỉ theo status.
  if (status === 429 || code?.includes('ATTEMPTS')) return 'tooManyRequests';
  if (code?.includes('OTP')) return 'invalidOtp';
  if (code?.includes('TOKEN')) return 'invalidToken';
  if (status === 404 || status === 501) return 'notAvailable';

  return 'generic';
}
