import { apiOrigin } from './env';
import type { SessionUser } from './session';

/**
 * Response THẬT `GET /api/account/me` (`AccountController.me`, NestJS REST
 * thuần — KHÔNG phải procedure oRPC, `contract.ts` không có namespace
 * `account`; JSDoc ví dụ `api.account.me(...)` ở `client.ts` là suy đoán từ
 * lúc Task 1 chưa chốt shape endpoint này, đừng theo). Trả THẲNG
 * `auth.$Infer.Session.user` (superset — kèm emailVerified/image/timestamps),
 * chỉ khai field UI thật sự đọc, cùng quy ước với `GetSessionApiResponse` ở
 * `session.ts`.
 */
interface AccountMeApiResponse {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  phone?: string | null;
}

/**
 * Đọc hồ sơ tài khoản (trang `/account/profile`, Task 6/A2) — fetch THẲNG
 * (không qua oRPC client, lý do trên) kèm cookie forward, `cache: 'no-store'`
 * (data per-user). `cookie` do TRANG tự đọc một lần qua `cookies()` rồi
 * truyền vào đây + `bookings.ts`/`wishlist.ts` (fetch song song `Promise.all`,
 * cùng một cookie).
 *
 * Đây là fetch "nội dung" riêng của trang profile (song song với cách các
 * trang khác đọc nội dung của mình qua `bookings.mine`/`wishlist.list`) —
 * trang vẫn gọi `requireSession()` riêng để GATE (luật chung mọi trang khu
 * `/account`), hàm này chỉ cấp phần thân hồ sơ để `ProfileForm` render.
 * Không `ok` (hiếm — race hết hạn session giữa hai lần gọi) thì ném lỗi, để
 * error boundary xử lý thay vì âm thầm hiện trang rỗng.
 */
export async function fetchAccountMe(cookie: string): Promise<SessionUser> {
  const response = await fetch(`${apiOrigin()}/api/account/me`, {
    headers: { cookie },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`GET /api/account/me failed with status ${response.status}`);
  }
  const user = (await response.json()) as AccountMeApiResponse;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? '',
    phone: user.phone ?? null,
  };
}

/**
 * Lỗi `DELETE /api/account` — giữ nguyên `status` HTTP để caller
 * (`DeleteAccount`) phân biệt 401 giữa chừng (session hết hạn — spec §5,
 * message + link đăng nhập lại) khỏi lỗi chung. `Error` trần không mang
 * field này.
 */
export class AccountDeleteError extends Error {
  constructor(public readonly status: number) {
    super(`DELETE /api/account failed with status ${status}`);
  }
}

/**
 * Xoá tài khoản (`DeleteAccount` ở `/account/profile`, Task 7/A2) — `DELETE
 * /api/account` REST thuần (KHÔNG phải oRPC, cùng lý do `fetchAccountMe` ở
 * trên), gọi TỪ BROWSER nên dùng `credentials: 'include'` (cookie httpOnly
 * tự gửi, ADR-0017 §1) thay vì forward cookie tay như bản server-fetch.
 * `AccountController.deleteOwnAccount` trả `204` rỗng — không có body để
 * parse; caller tự `authClient.signOut()` sau khi promise này resolve.
 */
export async function deleteAccount(): Promise<void> {
  const response = await fetch(`${apiOrigin()}/api/account`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new AccountDeleteError(response.status);
  }
}
