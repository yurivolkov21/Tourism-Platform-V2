/**
 * Ba trường URL của luồng social mà Better Auth redirect về sau callback.
 * Plugin `expo()` gắn cookie phiên vào URL đích khi nó là origin tin cậy
 * không phải http(s) — `nexora://` ở mọi môi trường, `exp://` ở development.
 */
const REDIRECT_FIELDS = ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL'] as const;

/** Hai route mở luồng redirect social của Better Auth. */
const SOCIAL_REDIRECT_PATHS = new Set(['/sign-in/social', '/link-social']);

/** Vì sao một request bị chặn; before-hook đổi thành thông điệp lỗi. */
export type MobileAuthRejection = 'authorizationProxy' | 'appCallback';

/** Giữ đúng chữ của lỗi gốc: plugin `expo()` (proxy) và Better Auth (callbackURL). */
export const MOBILE_AUTH_REJECTION_MESSAGES: Record<MobileAuthRejection, string> = {
  authorizationProxy: 'Invalid authorizationURL',
  appCallback: 'Invalid callbackURL',
};

export interface MobileAuthRequest {
  /** `ctx.path` của Better Auth, đã bỏ basePath (vd `/sign-in/social`). */
  path: string;
  body: unknown;
}

/**
 * URL tuyệt đối có scheme khác http/https — loại đích mà plugin `expo()` gắn
 * cookie phiên nếu tin cậy. Parse bằng `new URL` giống hệt after-hook của
 * plugin, nên biến thể nào parse ra cùng scheme (hoa thường, khoảng trắng hay ký
 * tự điều khiển ở đầu, tab hay xuống dòng giữa chuỗi) cũng bị bắt. Đường tương
 * đối không parse được, plugin cũng bỏ qua, nên cho qua.
 */
function isNonHttpAbsoluteUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol !== 'http:' && url.protocol !== 'https:';
}

/**
 * ADR-0056 §3: hai khoá cho đăng nhập Google của app mobile.
 *
 * 1. `GET /expo-authorization-proxy` luôn bị từ chối, ở mọi môi trường. App
 *    lấy ID token bằng SDK Google gốc nên không còn cần proxy; giữ proxy là
 *    giữ chuỗi chiếm phiên (kẻ tấn công cắm `state` của mình vào trình duyệt
 *    nạn nhân rồi nhận cookie phiên qua deep link).
 * 2. `/sign-in/social` và `/link-social` KHÔNG kèm `idToken` mà một trong ba
 *    URL đích là deep link (scheme khác http/https) thì bị từ chối. Đây là
 *    khoá thứ hai: bản plugin sau có mở lại proxy thì server cũng không còn
 *    luồng redirect nào đổ về deep link để gắn cookie. Nhánh `idToken` không
 *    redirect nên được đi tiếp.
 *
 * Hàm THUẦN để test riêng; before-hook ở `auth.config.ts` chỉ gọi nó.
 */
export function mobileAuthRejection({ path, body }: MobileAuthRequest): MobileAuthRejection | null {
  if (path === '/expo-authorization-proxy') return 'authorizationProxy';
  if (!SOCIAL_REDIRECT_PATHS.has(path)) return null;

  const fields = (body ?? {}) as Record<string, unknown>;
  // idToken phải là object thật mới tính là nhánh ID token — đúng hình dạng
  // schema của Better Auth; giá trị lạ không được mở khoá redirect.
  const idToken = fields.idToken;
  if (typeof idToken === 'object' && idToken !== null) return null;

  return REDIRECT_FIELDS.some((field) => isNonHttpAbsoluteUrl(fields[field]))
    ? 'appCallback'
    : null;
}
