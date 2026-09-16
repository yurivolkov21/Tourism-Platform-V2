import type { AuthActions, AuthResult } from './auth-actions';

/**
 * Bản GIẢ LẬP của `AuthActions` cho đợt dựng giao diện tĩnh (P5b-1).
 *
 * Đây là chỗ DUY NHẤT người làm hạ tầng thay: viết một `createBetterAuthActions()`
 * cùng hình dạng rồi đổi giá trị truyền vào `AuthActionsProvider` ở
 * `src/app/_layout.tsx`. Không màn nào phải sửa.
 *
 * Bảng kịch bản (spec P5b-1 §6) chọn theo email và mã nhập vào, để trên máy thật
 * bấm ra được TỪNG nhánh lỗi mà không cần API:
 *
 * | Nhập | Kết quả |
 * | --- | --- |
 * | `unverified@example.com` | `emailNotVerified` → chuyển sang Verify |
 * | mật khẩu `wrong-password` | `invalidCredentials` |
 * | `busy@example.com` | `tooManyRequests` |
 * | `offline@example.com` | `generic` |
 * | mã `000000` | `invalidOtp` |
 * | token `expired` | `invalidToken` |
 * | nút Google | `notAvailable` |
 */
export interface MockAuthOptions {
  /** Trễ mỗi lệnh bao nhiêu mili giây — để thấy được trạng thái đang gửi. */
  delayMs?: number;
}

const UNVERIFIED_EMAIL = 'unverified@example.com';
const BUSY_EMAIL = 'busy@example.com';
const OFFLINE_EMAIL = 'offline@example.com';
const WRONG_PASSWORD = 'wrong-password';
const INVALID_OTP = '000000';
const EXPIRED_TOKEN = 'expired';

export function createMockAuthActions({ delayMs = 600 }: MockAuthOptions = {}): AuthActions {
  const settle = async (result: AuthResult): Promise<AuthResult> => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return result;
  };

  const failFor = (email: string): AuthResult | null => {
    if (email === BUSY_EMAIL) return { ok: false, error: 'tooManyRequests' };
    if (email === OFFLINE_EMAIL) return { ok: false, error: 'generic' };
    return null;
  };

  return {
    signInWithEmail: ({ email, password }) => {
      const failure = failFor(email);
      if (failure !== null) return settle(failure);
      if (password === WRONG_PASSWORD) return settle({ ok: false, error: 'invalidCredentials' });
      if (email === UNVERIFIED_EMAIL) return settle({ ok: false, error: 'emailNotVerified' });
      return settle({ ok: true });
    },

    // Google trên mobile cần cấu hình phía hạ tầng (ADR-0017 §9), nên bản giả
    // lập nói thật: chưa bật. Đúng câu mà web nói khi provider chưa cấu hình.
    signInWithGoogle: () => settle({ ok: false, error: 'notAvailable' }),

    // Đăng ký LUÔN thành công, kể cả email đã có tài khoản: Better Auth cố ý trả
    // 200 giả để không lộ email nào đã đăng ký. Màn Verify là chỗ duy nhất nói
    // được chuyện đó, bằng câu nhắc `authForms.verifyEmail.existingAccountHint`.
    signUpWithEmail: ({ email }) => settle(failFor(email) ?? { ok: true }),

    verifyEmail: ({ otp }) =>
      settle(otp === INVALID_OTP ? { ok: false, error: 'invalidOtp' } : { ok: true }),

    resendVerificationCode: ({ email }) => settle(failFor(email) ?? { ok: true }),

    // Quên mật khẩu luôn báo thành công — API cố ý không nói email có tồn tại
    // hay không, và giao diện phải giữ đúng tinh thần đó.
    requestPasswordReset: () => settle({ ok: true }),

    resetPassword: ({ token }) =>
      settle(token === EXPIRED_TOKEN ? { ok: false, error: 'invalidToken' } : { ok: true }),
  };
}
