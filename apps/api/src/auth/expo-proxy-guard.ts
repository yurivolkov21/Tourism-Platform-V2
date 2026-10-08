/**
 * Endpoint authorization của Google mà Better Auth dựng (`@better-auth/core`
 * social-providers/google). Proxy chỉ được chuyển hướng tới ĐÚNG chỗ này.
 */
const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

export interface ExpoProxyAllowlist {
  /** `GOOGLE_CLIENT_ID` — thiếu nghĩa là Google chưa bật, proxy không có việc gì. */
  googleClientId: string | undefined;
  /** Base URL của Better Auth (gồm basePath, vd `https://api…/api/auth`). */
  authBaseUrl: string;
}

/**
 * B2 (review 05/10, ADR-0017 §11): `GET /expo-authorization-proxy` của plugin
 * `expo()` chỉ đòi `authorizationURL` là https và khác origin của API, rồi
 * redirect tới đó — tức open redirect trên domain API thật. App mobile vẫn cần
 * endpoint này cho đăng nhập Google, nên không tắt plugin mà khoá URL lại:
 * đúng endpoint Google, đúng `client_id` của mình, `redirect_uri` quay về
 * callback Google của chính API. Mọi thứ khác → từ chối.
 */
export function isAllowedExpoAuthorizationUrl(value: string, allow: ExpoProxyAllowlist): boolean {
  if (!allow.googleClientId) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // Có userinfo (`user:pass@`) thì không phải URL BA dựng — chặn luôn.
  if (url.username || url.password) return false;
  if (`${url.origin}${url.pathname}` !== GOOGLE_AUTHORIZATION_ENDPOINT) return false;
  if (url.searchParams.get('client_id') !== allow.googleClientId) return false;
  const callback = `${allow.authBaseUrl.replace(/\/+$/, '')}/callback/google`;
  return url.searchParams.get('redirect_uri') === callback;
}
