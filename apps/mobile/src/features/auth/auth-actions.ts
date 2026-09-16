import type { AuthErrorKey } from '@tourism/core';
import { createContext, useContext } from 'react';

/**
 * Lỗi mà một lệnh auth có thể trả về. Ngoài các khoá lỗi dùng chung với web
 * (`@tourism/core`) còn đúng một giá trị riêng: `emailNotVerified`.
 *
 * Nó KHÔNG phải câu để hiện ra — nó là lệnh chuyển màn (sang Verify email). Gói
 * chung vào đây thay vì đẻ một kiểu kết quả thứ hai vì mọi lệnh đều đi qua cùng
 * một chỗ xử lý ở màn.
 */
export type AuthFailure = AuthErrorKey | 'emailNotVerified';

export type AuthResult = { ok: true } | { ok: false; error: AuthFailure };

/**
 * Hợp đồng DUY NHẤT giữa màn hình và hạ tầng auth (spec P5b-1 §6).
 *
 * Đợt P5b-1 chỉ có bản giả lập. Người làm hạ tầng viết bản thật bằng
 * `@better-auth/expo` (ADR-0017 §9) với đúng hình dạng này rồi đổi provider ở
 * `src/app/_layout.tsx` — không màn nào phải sửa. Bảng đối chiếu từng method
 * sang lệnh Better Auth nằm ở `docs/conventions/mobile-auth-handoff.md`.
 */
export interface AuthActions {
  signInWithEmail(input: { email: string; password: string }): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  signUpWithEmail(input: { name: string; email: string; password: string }): Promise<AuthResult>;
  verifyEmail(input: { email: string; otp: string }): Promise<AuthResult>;
  resendVerificationCode(input: { email: string }): Promise<AuthResult>;
  requestPasswordReset(input: { email: string }): Promise<AuthResult>;
  resetPassword(input: { token: string; newPassword: string }): Promise<AuthResult>;
}

const AuthActionsContext = createContext<AuthActions | null>(null);

export const AuthActionsProvider = AuthActionsContext.Provider;

/**
 * Ném lỗi rõ nghĩa thay vì trả `undefined` — cùng nếp `useTheme` của
 * `@tourism/mobile-ui`: quên provider là một lỗi lập trình, và nó phải nổ ngay
 * chỗ quên chứ không đẩy một `undefined` đi xa rồi mới vỡ.
 */
export function useAuthActions(): AuthActions {
  const actions = useContext(AuthActionsContext);

  if (actions === null) {
    throw new Error('useAuthActions phải nằm trong <AuthActionsProvider>');
  }

  return actions;
}
