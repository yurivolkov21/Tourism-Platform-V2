/**
 * Key lỗi auth chuẩn hoá cho tầng UI (Task 3-6 dùng nguyên văn) — i18n copy
 * cho từng key là việc của Task 3, ở đây chỉ phân loại. Sweep 19/08 thêm
 * năm key mới cho các mã Better Auth từng bị gom vào `generic` dù server nói
 * rõ ô nào sai (`invalidEmail`, `passwordTooShort/Long`,
 * `wrongCurrentPassword`, `noPasswordAccount`).
 */
export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailExists'
  | 'tooManyRequests'
  | 'invalidOtp'
  | 'invalidToken'
  | 'notAvailable'
  | 'invalidEmail'
  | 'passwordTooShort'
  | 'passwordTooLong'
  | 'wrongCurrentPassword'
  | 'noPasswordAccount'
  | 'generic';

/**
 * Map lỗi thô từ Better Auth client (shape thực đo được từ
 * @better-fetch/fetch: `{ ...body, status, statusText }` — body server trả
 * về có `code`/`message` dạng UPPER_SNAKE_CASE, xem
 * better-call/src/error.d.ts và @better-auth/core error-codes.ts) sang
 * `AuthErrorKey` ổn định cho UI. Ưu tiên theo thứ tự: status cụ thể trước,
 * rồi tới khớp chuỗi con trong `code`.
 *
 * 401 đứng ĐẦU và thắng mọi code: khi đăng nhập, BA trả
 * `INVALID_EMAIL_OR_PASSWORD` — cố ý không tách "email sai" với "mật khẩu
 * sai" (chống dò tài khoản), UI phải giữ nguyên tinh thần đó.
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
  // Bốn mã 400 của BA nói rõ ô nào sai (đối chiếu dist/api/routes/sign-up.mjs
  // + update-user.mjs gói pin 1.6.23, không đoán). So BẰNG chứ không
  // `includes` — `INVALID_EMAIL` là tiền tố của `INVALID_EMAIL_OR_PASSWORD`,
  // và `INVALID_PASSWORD` cũng là hậu tố của mã đó.
  if (code === 'INVALID_EMAIL') return 'invalidEmail';
  if (code === 'PASSWORD_TOO_SHORT') return 'passwordTooShort';
  if (code === 'PASSWORD_TOO_LONG') return 'passwordTooLong';
  if (code === 'INVALID_PASSWORD') return 'wrongCurrentPassword';
  if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') return 'noPasswordAccount';
  if (code?.includes('OTP')) return 'invalidOtp';
  if (code?.includes('TOKEN')) return 'invalidToken';
  if (status === 404 || status === 501) return 'notAvailable';

  return 'generic';
}

/** Ô nhập mà một lỗi server "thuộc về" — để form hiện lỗi NGAY DƯỚI ô đó thay
 *  vì ở khối lỗi chung cuối form. */
export type AuthErrorField = 'email' | 'password' | 'currentPassword';

/**
 * Quy lỗi server về ô nhập (sweep 19/08). `password` nghĩa là ô mật khẩu
 * CHÍNH của form đó (register: password; reset/change: mật khẩu MỚI). Trả
 * `null` cho lỗi cấp form — sai thông tin đăng nhập, throttle, mạng…
 */
export function fieldOfAuthError(key: AuthErrorKey): AuthErrorField | null {
  switch (key) {
    case 'invalidEmail':
    case 'emailExists':
      return 'email';
    case 'passwordTooShort':
    case 'passwordTooLong':
      return 'password';
    case 'wrongCurrentPassword':
      return 'currentPassword';
    default:
      return null;
  }
}
