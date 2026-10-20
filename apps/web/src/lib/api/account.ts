import { unstable_rethrow } from 'next/navigation';
import { apiOrigin } from './env';
import type { SessionUser } from './session';

/**
 * Response THẬT `GET /api/account/me` (`AccountController.me`, NestJS REST
 * thuần — KHÔNG phải procedure oRPC, `contract.ts` không có namespace
 * `account`; JSDoc ví dụ `api.account.me(...)` ở `client.ts` là suy đoán từ
 * lúc Task 1 chưa chốt shape endpoint này, đừng theo). Trả THẲNG
 * `auth.$Infer.Session.user` (superset — kèm emailVerified/timestamps), chỉ
 * khai field UI thật sự đọc, cùng quy ước với `GetSessionApiResponse` ở
 * `session.ts` — `image` đã vào danh sách này (Task 8, ADR-0021): khối
 * AvatarUpload ở Settings đọc avatar đã lưu qua field này.
 */
interface AccountMeApiResponse {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  phone?: string | null;
  image?: string | null;
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
    image: user.image ?? null,
  };
}

/** Cách đăng nhập mà mục Connected accounts của Settings biết in (review L1-08). */
export type SignInMethod = 'password' | 'google';

/** `providerId` của Better Auth → cách đăng nhập; thứ tự mảng là thứ tự in trên thẻ. */
const SIGN_IN_METHODS: ReadonlyArray<readonly [providerId: string, method: SignInMethod]> = [
  ['credential', 'password'],
  ['google', 'google'],
];

/**
 * Đọc cách đăng nhập của khách (review L1-08): trước đây thẻ danh tính luôn in "Email & password",
 * nên khách chỉ đăng nhập Google đọc thấy mình có mật khẩu. Fetch THẲNG `GET /api/auth/list-accounts`
 * của Better Auth (mỗi row một `providerId`) kèm cookie forward, `no-store`, như `fetchAccountMe`.
 *
 * Đây là mục phụ của trang: lỗi gì (API lỗi, mạng, body lạ) cũng trả `null` để thẻ bỏ mục này,
 * KHÔNG ném lên error boundary như `fetchAccountMe`. Provider web chưa biết in thì bỏ qua.
 */
export async function fetchSignInMethods(cookie: string): Promise<SignInMethod[] | null> {
  try {
    const response = await fetch(`${apiOrigin()}/api/auth/list-accounts`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return null;
    const providers = new Set(
      (rows as Array<{ providerId?: unknown } | null>).map((row) => row?.providerId),
    );
    return SIGN_IN_METHODS.filter(([providerId]) => providers.has(providerId)).map(
      ([, method]) => method,
    );
  } catch (error) {
    // Lỗi nội bộ của Next (route chuyển sang dynamic lúc build) phải đi thẳng ra, cùng lý do
    // `session.ts`; nuốt nó thành `null` là trang bị dựng tĩnh với mục này trống.
    unstable_rethrow(error);
    return null;
  }
}

/**
 * Lỗi `DELETE /api/account` — giữ nguyên `status` HTTP để caller
 * (`DeleteAccount`) phân biệt 401 giữa chừng (session hết hạn — spec §5,
 * message + link đăng nhập lại) khỏi lỗi chung. `Error` trần không mang
 * field này.
 */
export class AccountDeleteError extends Error {
  constructor(
    public readonly status: number,
    /** Mã trong envelope lỗi API (ADR-0017 §7b) — INVALID_PASSWORD /
     *  ACCOUNT_HAS_PAID_BOOKINGS / ACCOUNT_HAS_OPEN_CANCELLATION /
     *  CREDENTIAL_ACCOUNT_NOT_FOUND…; thiếu body parse được thì undefined. */
    public readonly code?: string,
  ) {
    super(`DELETE /api/account failed with status ${status}`);
  }
}

/**
 * Xoá tài khoản (`DeleteAccount` ở `/account/profile`, Task 7/A2) — `DELETE
 * /api/account` REST thuần (KHÔNG phải oRPC, cùng lý do `fetchAccountMe` ở
 * trên), gọi TỪ BROWSER nên dùng `credentials: 'include'` (cookie httpOnly
 * tự gửi, ADR-0017 §1) thay vì forward cookie tay như bản server-fetch.
 * ADR-0017 §7b: body mang `password` — server xác thực lại trước khi
 * tombstone. `AccountController.deleteOwnAccount` trả `204` rỗng — không có
 * body để parse; caller tự `authClient.signOut()` sau khi promise resolve.
 */
export async function deleteAccount(password: string): Promise<void> {
  const response = await fetch(`${apiOrigin()}/api/account`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    // Envelope lỗi chung của API {defined, code, status, message} — code là
    // phần web cần; body không phải JSON (proxy chen giữa…) thì bỏ qua.
    const code = await response
      .json()
      .then((body: unknown) =>
        typeof body === 'object' && body !== null && 'code' in body
          ? String((body as { code: unknown }).code)
          : undefined,
      )
      .catch(() => undefined);
    throw new AccountDeleteError(response.status, code);
  }
}
