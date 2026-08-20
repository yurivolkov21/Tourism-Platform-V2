import { cookies } from 'next/headers';
import { cache } from 'react';
import { apiOrigin } from './env';

/**
 * Session user tối giản cho admin — port từ `apps/web/src/lib/api/session.ts`
 * (ADR-0017 §3), rút còn field shell/nav-user cần. `role` là additionalField
 * do `apps/api/src/auth/auth.config.ts` khai.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
}

/**
 * Shape response THẬT `GET /api/auth/get-session` (better-auth 1.6.23): trả
 * `{ session, user } | null` — KHÔNG 401 khi thiếu cookie, endpoint tự trả
 * body `null` (status 200). Xem đối chiếu chi tiết ở session.ts của web.
 */
interface GetSessionApiResponse {
  session: unknown;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
    deletedAt?: string | null;
    image?: string | null;
  };
}

/**
 * Đọc session server-side — fetch thẳng get-session kèm cookie forward,
 * `no-store` (data per-user), React `cache()` dedupe trong một render.
 * KHÔNG throw: mọi lỗi (mạng/parse/tombstone) đều trả null để tầng gọi
 * (layout admin) quyết theo `decideAdminAccess` — fail-closed.
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
      image: user.image ?? null,
    };
  } catch {
    return null;
  }
});
