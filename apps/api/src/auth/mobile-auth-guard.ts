/**
 * Ba trường URL của luồng social mà Better Auth redirect về sau callback.
 * Plugin `expo()` gắn cookie phiên vào URL đích khi nó là origin tin cậy
 * không phải http — tức đúng `nexora://`.
 */
const REDIRECT_FIELDS = ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL'] as const;

/** Hai route mở luồng redirect social của Better Auth. */
const SOCIAL_REDIRECT_PATHS = new Set(['/sign-in/social', '/link-social']);

/**
 * Scheme của app (`app.json` → `scheme`). So cả dạng không có `//`
 * (`nexora:saved`) vì hệ điều hành vẫn mở app với URL ấy.
 */
const APP_SCHEME = /^nexora:/i;

export interface MobileAuthRequest {
  /** `ctx.path` của Better Auth, đã bỏ basePath (vd `/sign-in/social`). */
  path: string;
  body: unknown;
}

/**
 * ADR-0056 §3: hai khoá cho đăng nhập Google của app mobile.
 *
 * 1. `GET /expo-authorization-proxy` luôn bị từ chối, ở mọi môi trường. App
 *    lấy ID token bằng SDK Google gốc nên không còn cần proxy; giữ proxy là
 *    giữ chuỗi chiếm phiên (kẻ tấn công cắm `state` của mình vào trình duyệt
 *    nạn nhân rồi nhận cookie phiên qua deep link).
 * 2. `/sign-in/social` và `/link-social` KHÔNG kèm `idToken` mà một trong ba
 *    URL đích là scheme của app thì bị từ chối. Đây là khoá thứ hai: bản
 *    plugin sau có mở lại proxy thì server cũng không còn luồng redirect nào
 *    đổ về deep link để gắn cookie. Nhánh `idToken` không redirect nên được
 *    đi tiếp.
 *
 * Hàm THUẦN để test riêng; before-hook ở `auth.config.ts` chỉ gọi nó.
 */
export function rejectsMobileAuthRequest({ path, body }: MobileAuthRequest): boolean {
  if (path === '/expo-authorization-proxy') return true;
  if (!SOCIAL_REDIRECT_PATHS.has(path)) return false;

  const fields = (body ?? {}) as Record<string, unknown>;
  // idToken phải là object thật mới tính là nhánh ID token — đúng hình dạng
  // schema của Better Auth; giá trị lạ không được mở khoá redirect.
  const idToken = fields.idToken;
  if (typeof idToken === 'object' && idToken !== null) return false;

  return REDIRECT_FIELDS.some((field) => {
    const value = fields[field];
    return typeof value === 'string' && APP_SCHEME.test(value.trim());
  });
}
