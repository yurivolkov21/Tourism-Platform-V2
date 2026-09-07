import { createAuthClient } from 'better-auth/react';
import { browserApiOrigin } from '@/lib/api/env';

/**
 * Client Better Auth DUY NHẤT của admin (ADR-0026 §2) — cùng hệ với web:
 * cookie httpOnly do API phát trên `.nexora-travel.agency`, browser gọi
 * thẳng origin API. Admin chỉ cần signIn/signOut — KHÔNG mang plugin OTP
 * hay additionalFields (đăng ký/quên mật khẩu là việc của www).
 */
export const authClient = createAuthClient({
  // CHỈ tính origin trong browser (W3-O2): authClient chỉ được GỌI từ
  // handler client-side, còn lúc `next build` (NODE_ENV=production, env dev
  // http) module này vẫn bị evaluate khi prerender /login — gọi resolver ở
  // đây là phép ép https giết build. Server không bao giờ dùng client này
  // nên baseURL phía server để undefined vô hại. Trong browser, env đã được
  // `next.config.ts` kiểm lúc build (fail-fast ồn ào) nên nhánh này không
  // còn là nơi đầu tiên phát hiện thiếu NEXT_PUBLIC_API_URL.
  baseURL: typeof window === 'undefined' ? undefined : browserApiOrigin(),
});
