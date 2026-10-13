import { describe, expect, it } from 'vitest';
import { rejectsMobileAuthRequest } from './mobile-auth-guard.js';

/** URL Google hợp lệ đúng như Better Auth dựng — chốt §11 cũ từng cho qua loại này. */
const VALID_GOOGLE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=client-123.apps.googleusercontent.com&state=abc&redirect_uri=https%3A%2F%2Fapi.nexora-travel.agency%2Fapi%2Fauth%2Fcallback%2Fgoogle';

describe('rejectsMobileAuthRequest (ADR-0056 §3 — đóng proxy, chặn deep link chở phiên)', () => {
  it('chặn GET /expo-authorization-proxy kể cả khi URL Google hợp lệ', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/expo-authorization-proxy',
        body: undefined,
      }),
    ).toBe(true);
    // Query không đổi được kết luận: proxy đóng ở mọi môi trường.
    expect(
      rejectsMobileAuthRequest({
        path: '/expo-authorization-proxy',
        body: { authorizationURL: VALID_GOOGLE_URL },
      }),
    ).toBe(true);
  });

  it('chặn /sign-in/social không có idToken mà callbackURL là nexora://', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: 'nexora://saved' },
      }),
    ).toBe(true);
  });

  it('cho qua cùng request đó khi có idToken — luồng của app mới', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: 'nexora://saved', idToken: { token: 'jwt' } },
      }),
    ).toBe(false);
  });

  it('cho qua callbackURL của web: đường tương đối hoặc https', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: '/' },
      }),
    ).toBe(false);
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: 'https://www.nexora-travel.agency/account' },
      }),
    ).toBe(false);
    expect(
      rejectsMobileAuthRequest({ path: '/sign-in/social', body: { provider: 'google' } }),
    ).toBe(false);
  });

  it('chặn errorCallbackURL hoặc newUserCallbackURL là nexora:// dù callbackURL sạch', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: '/', errorCallbackURL: 'nexora://error' },
      }),
    ).toBe(true);
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: '/', newUserCallbackURL: 'nexora://welcome' },
      }),
    ).toBe(true);
  });

  it('chặn /link-social không có idToken mà callbackURL là nexora://', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/link-social',
        body: { provider: 'google', callbackURL: 'nexora://x' },
      }),
    ).toBe(true);
  });

  it('bắt cả scheme nexora: không có hai gạch chéo — vẫn là deep link mở app', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: 'nexora:saved' },
      }),
    ).toBe(true);
  });

  it('không so phân biệt hoa thường của scheme — URL coi NEXORA:// là cùng scheme', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: 'NEXORA://saved' },
      }),
    ).toBe(true);
    expect(
      rejectsMobileAuthRequest({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: '  nexora://saved' },
      }),
    ).toBe(true);
  });

  it('idToken phải là object thật — chuỗi rỗng, null hay giá trị lạ không mở khoá', () => {
    for (const idToken of [null, '', 0, false, 'jwt']) {
      expect(
        rejectsMobileAuthRequest({
          path: '/sign-in/social',
          body: { provider: 'google', callbackURL: 'nexora://saved', idToken },
        }),
      ).toBe(true);
    }
  });

  it('không đụng các path khác, kể cả khi body mang nexora://', () => {
    expect(
      rejectsMobileAuthRequest({
        path: '/request-password-reset',
        body: { email: 'a@b.c', redirectTo: 'nexora://reset-password' },
      }),
    ).toBe(false);
    expect(rejectsMobileAuthRequest({ path: '/sign-in/email', body: undefined })).toBe(false);
  });
});
