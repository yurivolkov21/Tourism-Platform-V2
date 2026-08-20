import { createAuthClient } from 'better-auth/react';
import { apiOrigin } from '@/lib/api/env';

/**
 * Client Better Auth DUY NHẤT của admin (ADR-0026 §2) — cùng hệ với web:
 * cookie httpOnly do API phát trên `.nexora-travel.agency`, browser gọi
 * thẳng origin API. Admin chỉ cần signIn/signOut — KHÔNG mang plugin OTP
 * hay additionalFields (đăng ký/quên mật khẩu là việc của www).
 */
export const authClient = createAuthClient({
  baseURL: apiOrigin(),
});
