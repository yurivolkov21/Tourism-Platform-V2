import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { apiOrigin } from '@/lib/api/env';

/**
 * Client Better Auth DUY NHẤT của web (ADR-0017 §1) — cookie httpOnly do API
 * phát, browser gọi thẳng origin API (không proxy, không Bearer). baseURL
 * dùng lại apiOrigin() — không lặp base-URL (bài học Nexora 8 file).
 */
export const authClient = createAuthClient({
  baseURL: apiOrigin(),
  plugins: [emailOTPClient()],
});

export const { useSession } = authClient;
