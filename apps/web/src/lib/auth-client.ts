import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { apiOrigin } from '@/lib/api/env';

/**
 * Client Better Auth DUY NHẤT của web (ADR-0017 §1) — cookie httpOnly do API
 * phát, browser gọi thẳng origin API (không proxy, không Bearer). baseURL
 * dùng lại apiOrigin() — không lặp base-URL (bài học Nexora 8 file).
 *
 * `inferAdditionalFields` (Task 7/A2): khai LẠI đúng shape `additionalFields.
 * phone` của server (`apps/api/src/auth/auth.config.ts`) — CHỈ để `authClient.
 * updateUser({ name, phone })` (`profile-form.tsx`) type-check được `phone`.
 * Không import type từ `apps/api` (hai app deploy tách rời, ADR-0016) nên
 * phải khai tay; server vẫn là chốt validate thật (body server-side là
 * `z.record` — chấp nhận field lạ, xem JSDoc `update-user.mjs` đối chiếu ở
 * `profile-form.tsx`), khai sai ở đây chỉ lệch TYPE, không lệch RUNTIME.
 */
export const authClient = createAuthClient({
  // CHỈ tính origin trong browser (vòng vá review W3, cùng khuôn admin):
  // module này bị evaluate cả lúc `next build` prerender (NODE_ENV=production)
  // — apiOrigin() nay fail-fast nên gọi ở module scope phía server là giết
  // build với env dev; client Better Auth chỉ được GỌI từ browser, baseURL
  // phía server để undefined vô hại.
  baseURL: typeof window === 'undefined' ? undefined : apiOrigin(),
  plugins: [
    emailOTPClient(),
    inferAdditionalFields({
      user: { phone: { type: 'string', required: false } },
    }),
  ],
});

export const { useSession } = authClient;
