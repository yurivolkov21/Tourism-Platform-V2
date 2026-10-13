import { mapAuthError } from '@tourism/core';
import { getAuthClient } from '@/lib/auth-client';
import { env } from '@/lib/env';
import type { AuthActions, AuthResult, GoogleResult } from './auth-actions';
import { loadGoogleSdk, requestGoogleIdToken } from './google-native';

/**
 * Bản THẬT của `AuthActions` (bàn giao P5b-1 → hạ tầng, ADR-0017 §9) — thay
 * `createMockAuthActions()` ở `src/app/_layout.tsx`. Cùng hình dạng, cùng ba
 * luật của `docs/handoff/mobile-auth-handoff.md` §2:
 *
 * 1. Mọi lỗi đi qua `mapAuthError` của `@tourism/core` — không tự đọc `error.code`.
 * 2. `fetch` ném (mạng đứt) → `{ ok: false, error: 'generic' }`, không để reject
 *    chạy lên `ErrorBoundary`.
 * 3. `emailNotVerified` là lệnh chuyển màn, không gộp vào nhánh lỗi chung.
 */
export function createBetterAuthActions(): AuthActions {
  return {
    async signInWithEmail({ email, password }): Promise<AuthResult> {
      try {
        const { error } = await getAuthClient().signIn.email({ email, password });
        if (!error) return { ok: true };
        if (error.code === 'EMAIL_NOT_VERIFIED') {
          // Fire-and-forget như web: OTP của lượt signup có thể đã hết hạn.
          void getAuthClient()
            .emailOtp.sendVerificationOtp({ email, type: 'email-verification' })
            .catch(() => {});
          return { ok: false, error: 'emailNotVerified' };
        }
        return { ok: false, error: mapAuthError(error) };
      } catch {
        return { ok: false, error: 'generic' };
      }
    },

    // ADR-0056 §1: lấy ID token bằng SDK Google gốc rồi đổi lấy phiên. Không
    // trình duyệt, không redirect, không deep link chở cookie — client Expo thấy
    // `idToken` thì lưu `set-cookie` của response vào SecureStore như đăng nhập
    // email. Luồng redirect cũ (và bước hỏi lại phiên của F12) đã bỏ.
    async signInWithGoogle(): Promise<GoogleResult> {
      try {
        const google = env().google;
        const sdk = loadGoogleSdk();
        // Route đã ẩn nút trong trường hợp này; chốt lại ở đây cho chắc.
        if (sdk === null || google === null) return { ok: false, error: 'notAvailable' };

        const result = await requestGoogleIdToken(sdk, google);
        if (result.kind === 'cancelled') return { ok: false, error: 'cancelled' };
        if (result.kind === 'error') return { ok: false, error: 'generic' };

        const { error } = await getAuthClient().signIn.social({
          provider: 'google',
          idToken: { token: result.idToken },
        });
        if (!error) return { ok: true };
        // 401 ở nhánh này là token bị từ chối (hết hạn, sai audience) — không
        // phải "sai email hay mật khẩu" như `mapAuthError` hiểu cho đăng nhập email.
        const mapped = mapAuthError(error);
        return { ok: false, error: mapped === 'invalidCredentials' ? 'generic' : mapped };
      } catch {
        return { ok: false, error: 'generic' };
      }
    },

    async signUpWithEmail({ name, email, password }): Promise<AuthResult> {
      try {
        const { error } = await getAuthClient().signUp.email({ name, email, password });
        return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
      } catch {
        return { ok: false, error: 'generic' };
      }
    },

    async verifyEmail({ email, otp }): Promise<AuthResult> {
      try {
        const { error } = await getAuthClient().emailOtp.verifyEmail({ email, otp });
        return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
      } catch {
        return { ok: false, error: 'generic' };
      }
    },

    async resendVerificationCode({ email }): Promise<AuthResult> {
      try {
        const { error } = await getAuthClient().emailOtp.sendVerificationOtp({
          email,
          type: 'email-verification',
        });
        return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
      } catch {
        return { ok: false, error: 'generic' };
      }
    },

    // API cố ý không nói email có tồn tại hay không (chống dò tài khoản) —
    // luôn báo thành công trừ khi mạng đứt thật, đúng nếp web.
    async requestPasswordReset({ email }): Promise<AuthResult> {
      try {
        await getAuthClient().requestPasswordReset({
          email,
          redirectTo: 'nexora://reset-password',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'generic' };
      }
    },

    async resetPassword({ token, newPassword }): Promise<AuthResult> {
      try {
        const { error } = await getAuthClient().resetPassword({ newPassword, token });
        return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
      } catch {
        return { ok: false, error: 'generic' };
      }
    },
  };
}
