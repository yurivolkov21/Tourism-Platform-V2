import { cookies } from 'next/headers';
import { cache } from 'react';
import { apiOrigin } from './env';

/**
 * Session user tối giản cho admin — port từ `apps/web/src/lib/api/session.ts`
 * (ADR-0017 §3), rút còn field sidebar/nav-user cần. `role` là additionalField
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
 * Kết quả tra phiên có PHÂN BIỆT nguyên nhân rỗng (vòng vá review F6):
 *
 * - `ok` — API trả lời và phiên hợp lệ.
 * - `none` — API TRẢ LỜI rằng không có phiên (thiếu cookie, phiên hết hạn,
 *   tài khoản tombstone). Đây mới là "mời đăng nhập lại".
 * - `unreachable` — KHÔNG HỎI ĐƯỢC API (mạng đứt, API sập, response rác).
 *   Gộp ca này vào `none` là nói dối: hai route export từng trả 401 "Your
 *   session has expired" khi Render sập, admin đăng xuất/đăng nhập vô ích
 *   trong khi phiên còn nguyên — và nhánh 502 có lời không bao giờ chạy.
 *
 * Cả hai ca xấu đều KHÔNG mang session — fail-closed giữ nguyên; cái khác
 * nhau chỉ là CÂU trả về cho người bấm nút.
 */
export type SessionLookup =
  | { kind: 'ok'; user: SessionUser }
  | { kind: 'none' }
  | { kind: 'unreachable' };

/**
 * Tra phiên server-side — fetch thẳng get-session kèm cookie forward,
 * `no-store` (data per-user), React `cache()` dedupe trong một render.
 * KHÔNG throw: mọi lỗi phân loại vào `SessionLookup` để tầng gọi tự quyết.
 */
export const lookupServerSession = cache(async (): Promise<SessionLookup> => {
  try {
    const cookieHeader = (await cookies()).toString();
    const response = await fetch(`${apiOrigin()}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    // get-session KHÔNG 401 khi thiếu cookie (trả body `null` với status 200
    // — xem shape ở trên), nên một status ngoài 2xx nghĩa là API đang hỏng
    // chứ không phải "không có phiên".
    if (!response.ok) return { kind: 'unreachable' };

    const data = (await response.json()) as GetSessionApiResponse | null;
    if (!data || data.user.deletedAt != null) return { kind: 'none' };

    const { user } = data;
    return {
      kind: 'ok',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role ?? '',
        image: user.image ?? null,
      },
    };
  } catch {
    return { kind: 'unreachable' };
  }
});

/**
 * Bản rút gọn cho layout/page: mọi ca không-ok đều là `null` vì đích đến
 * giống nhau (redirect `/login` qua `decideAdminAccess`) — chỉ route export
 * mới cần phân biệt câu chữ nên mới gọi thẳng `lookupServerSession`.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const lookup = await lookupServerSession();
  return lookup.kind === 'ok' ? lookup.user : null;
}
