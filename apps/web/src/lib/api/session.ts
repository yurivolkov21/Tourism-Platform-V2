import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { apiOrigin } from './env';

/**
 * Session user tối giản dùng ở khu `/account` (ADR-0017 §3) — subset field
 * BA thật cần cho UI, KHÔNG phải toàn bộ payload user (đối chiếu THẬT §9).
 * `role`/`phone`/`deletedAt` là `additionalFields` do `apps/api/src/auth/
 * auth.config.ts` khai — đo qua `SessionUser = typeof auth.$Infer.Session.user`
 * ở đó, KHÔNG đoán từ type suy diễn của BA client. `image` là field GỐC của
 * Better Auth (không phải additionalFields) — Task 8 (ADR-0021) nối UI đọc
 * thật (navbar/hộ chiếu/Settings), thêm vào đây.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  image: string | null;
}

/**
 * Shape response THẬT `GET /api/auth/get-session` (better-auth 1.6.23, đối
 * chiếu `dist/api/routes/session.d.mts` + `dist/api/routes/session.mjs`):
 * trả `{ session, user } | null` — KHÔNG 401 khi thiếu cookie, endpoint tự
 * `return null` (status 200, body `null`) lúc không đọc được
 * `sessionCookieToken`. Chỉ khai field session.ts THẬT SỰ đọc — `image` giờ
 * UI đọc thật (Task 8, ADR-0021) nên đã vào danh sách; các field BA khác
 * (emailVerified/createdAt/updatedAt…) vẫn bỏ qua có chủ đích.
 */
interface GetSessionApiResponse {
  session: unknown;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
    phone?: string | null;
    deletedAt?: string | null;
    image?: string | null;
  };
}

/**
 * Đọc session server-side (ADR-0017 §3) — fetch THẲNG `GET /api/auth/
 * get-session` (endpoint của Better Auth, KHÔNG qua oRPC contract vì đây
 * không phải procedure của contract) kèm cookie forward từ `next/headers`,
 * `cache: 'no-store'` (data per-user — KHÔNG revalidate/tag). React `cache()`
 * dedupe: nhiều nơi gọi trong CÙNG một render (vd layout + page) chỉ tốn một
 * fetch.
 *
 * KHÔNG throw trong mọi trường hợp — response không-ok, lỗi mạng, hay lỗi
 * parse JSON đều trả `null` để page tự quyết redirect (defense-in-depth,
 * `requireSession` bên dưới). User đã tombstone (`deletedAt != null`) coi
 * như null-session — khớp `apps/api/src/auth/auth.guard.ts` phía API
 * (`session.user.deletedAt != null` → 401).
 */
export const getServerSession = cache(async (): Promise<SessionUser | null> => {
  try {
    const cookieHeader = (await cookies()).toString();
    const response = await fetch(`${apiOrigin()}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const data = (await response.json()) as GetSessionApiResponse | null;
    if (!data || data.user.deletedAt != null) return null;

    const { user } = data;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role ?? '',
      phone: user.phone ?? null,
      image: user.image ?? null,
    };
  } catch {
    return null;
  }
});

/**
 * Bắt buộc có session cho trang server component ở khu `/account` — gọi
 * `getServerSession()`, null thì redirect `/login?redirect=<path đã encode>`
 * (`safeRedirect` là việc của TRANG LOGIN khi đọc lại param này, đã có từ
 * cụm auth — `lib/safe-redirect.ts`). `redirect()` của Next LUÔN throw để
 * ngắt render tại chỗ gọi nên hàm này không bao giờ trả về khi session null.
 */
export async function requireSession(redirectTo: string): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }
  return session;
}
