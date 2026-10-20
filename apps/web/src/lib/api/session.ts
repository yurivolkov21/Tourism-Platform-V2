import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
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
    lockedAt?: string | null;
    image?: string | null;
  };
}

/**
 * API không trả lời được câu "ai đang đăng nhập" (5xx, 429, lỗi mạng, body hỏng). KHÁC
 * "chưa đăng nhập" (200 body `null`): review L3-19 (sửa ở L1) — gộp hai ca thành `null` là
 * đẩy khách ĐÃ đăng nhập sang /login mỗi lần API đang khởi động lại hay đang deploy.
 */
export class SessionUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Session lookup failed', { cause });
    this.name = 'SessionUnavailableError';
  }
}

/**
 * Đọc session server-side (ADR-0017 §3) — fetch THẲNG `GET /api/auth/
 * get-session` (endpoint của Better Auth, KHÔNG qua oRPC contract vì đây
 * không phải procedure của contract) kèm cookie forward từ `next/headers`,
 * `cache: 'no-store'` (data per-user — KHÔNG revalidate/tag). React `cache()`
 * dedupe: nhiều nơi gọi trong CÙNG một render (vd layout + page) chỉ tốn một
 * fetch.
 *
 * User đã tombstone (`deletedAt != null`) hay đang bị khoá (`lockedAt != null`,
 * ADR-0052) coi như null-session — khớp `apps/api/src/auth/auth.guard.ts` phía
 * API (hai vế ấy → 401). API không trả lời được thì ném `SessionUnavailableError`.
 */
const readServerSession = cache(async (): Promise<SessionUser | null> => {
  let data: GetSessionApiResponse | null;
  try {
    const cookieHeader = (await cookies()).toString();
    const response = await fetch(`${apiOrigin()}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`get-session ${response.status}`);
    data = (await response.json()) as GetSessionApiResponse | null;
  } catch (error) {
    // Lỗi nội bộ của Next (cookies() lúc build tĩnh chuyển route sang dynamic) phải đi thẳng ra;
    // bọc lại là build chết ở mọi trang gọi requireSession.
    unstable_rethrow(error);
    throw new SessionUnavailableError(error);
  }
  if (!data || data.user.deletedAt != null || data.user.lockedAt != null) return null;

  const { user } = data;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? '',
    phone: user.phone ?? null,
    image: user.image ?? null,
  };
});

/**
 * Session cho trang mà đăng nhập là TUỲ CHỌN (vd `/tours/[slug]/enquire` điền sẵn form).
 * KHÔNG throw: API không trả lời được thì cũng `null`, trang vẫn dựng được cho khách vãng lai.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  try {
    return await readServerSession();
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

/**
 * Bắt buộc có session cho trang server component ở khu `/account` — đọc
 * `readServerSession()`, null thì redirect `/login?redirect=<path đã encode>`
 * (`safeRedirect` là việc của TRANG LOGIN khi đọc lại param này, đã có từ
 * cụm auth — `lib/safe-redirect.ts`). `redirect()` của Next LUÔN throw để
 * ngắt render tại chỗ gọi nên hàm này không bao giờ trả về khi session null.
 */
export async function requireSession(redirectTo: string): Promise<SessionUser> {
  // API không trả lời được thì để `SessionUnavailableError` nổi lên error boundary của route
  // (báo lỗi, có nút thử lại) thay vì coi như chưa đăng nhập.
  const session = await readServerSession();
  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }
  return session;
}
