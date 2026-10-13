import { describe, expect, it } from 'vitest';
import { MOBILE_AUTH_REJECTION_MESSAGES, mobileAuthRejection } from './mobile-auth-guard.js';

/** URL Google hợp lệ đúng như Better Auth dựng — chốt §11 cũ từng cho qua loại này. */
const VALID_GOOGLE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=client-123.apps.googleusercontent.com&state=abc&redirect_uri=https%3A%2F%2Fapi.nexora-travel.agency%2Fapi%2Fauth%2Fcallback%2Fgoogle';

/** Request đăng nhập Google kiểu redirect (không idToken) với một callbackURL. */
function socialWithCallback(callbackURL: string) {
  return mobileAuthRejection({
    path: '/sign-in/social',
    body: { provider: 'google', callbackURL },
  });
}

describe('mobileAuthRejection (ADR-0056 §3 — đóng proxy, chặn deep link chở phiên)', () => {
  it('chặn GET /expo-authorization-proxy kể cả khi URL Google hợp lệ', () => {
    expect(mobileAuthRejection({ path: '/expo-authorization-proxy', body: undefined })).toBe(
      'authorizationProxy',
    );
    // Query không đổi được kết luận: proxy đóng ở mọi môi trường.
    expect(
      mobileAuthRejection({
        path: '/expo-authorization-proxy',
        body: { authorizationURL: VALID_GOOGLE_URL },
      }),
    ).toBe('authorizationProxy');
  });

  it('chặn /sign-in/social không có idToken mà callbackURL là nexora://', () => {
    expect(socialWithCallback('nexora://saved')).toBe('appCallback');
  });

  it('cho qua cùng request đó khi có idToken — luồng của app mới', () => {
    expect(
      mobileAuthRejection({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: 'nexora://saved', idToken: { token: 'jwt' } },
      }),
    ).toBeNull();
  });

  it('cho qua callbackURL của web: đường tương đối, http hoặc https', () => {
    expect(socialWithCallback('/')).toBeNull();
    expect(socialWithCallback('/account?tab=trips')).toBeNull();
    expect(socialWithCallback('https://www.nexora-travel.agency/account')).toBeNull();
    expect(socialWithCallback('http://localhost:3000/account')).toBeNull();
    expect(
      mobileAuthRejection({ path: '/sign-in/social', body: { provider: 'google' } }),
    ).toBeNull();
  });

  it('chặn errorCallbackURL hoặc newUserCallbackURL là nexora:// dù callbackURL sạch', () => {
    expect(
      mobileAuthRejection({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: '/', errorCallbackURL: 'nexora://error' },
      }),
    ).toBe('appCallback');
    expect(
      mobileAuthRejection({
        path: '/sign-in/social',
        body: { provider: 'google', callbackURL: '/', newUserCallbackURL: 'nexora://welcome' },
      }),
    ).toBe('appCallback');
  });

  it('chặn /link-social không có idToken mà callbackURL là nexora://', () => {
    expect(
      mobileAuthRejection({
        path: '/link-social',
        body: { provider: 'google', callbackURL: 'nexora://x' },
      }),
    ).toBe('appCallback');
  });

  it('bắt cả scheme nexora: không có hai gạch chéo — vẫn là deep link mở app', () => {
    expect(socialWithCallback('nexora:saved')).toBe('appCallback');
  });

  it('chặn mọi scheme không phải http/https, không riêng nexora: — exp:// là origin tin cậy ở development', () => {
    // Plugin `expo()` tự thêm `exp://` vào trustedOrigins khi NODE_ENV=development
    // và gắn cookie cho BẤT KỲ deep link tin cậy nào, nên khoá theo scheme của
    // app là chưa đủ.
    expect(socialWithCallback('exp://192.168.1.10:8081/--/saved')).toBe('appCallback');
    expect(socialWithCallback('com.example.other://callback')).toBe('appCallback');
  });

  it('parse như plugin: hoa thường, khoảng trắng đầu, tab, xuống dòng hay ký tự điều khiển không lách được', () => {
    // `new URL` (plugin dùng đúng hàm này) bỏ khoảng trắng và ký tự điều khiển
    // đầu cuối, bỏ tab và xuống dòng giữa chuỗi, hạ chữ thường scheme.
    for (const callbackURL of [
      'NEXORA://saved',
      '  nexora://saved',
      'nex\tora://saved',
      'nexora\n://saved',
      '\u0000nexora://saved',
      '\u001fexp://192.168.1.10:8081',
    ]) {
      expect(socialWithCallback(callbackURL)).toBe('appCallback');
    }
  });

  it('idToken phải là object thật — chuỗi rỗng, null hay giá trị lạ không mở khoá', () => {
    for (const idToken of [null, '', 0, false, 'jwt']) {
      expect(
        mobileAuthRejection({
          path: '/sign-in/social',
          body: { provider: 'google', callbackURL: 'nexora://saved', idToken },
        }),
      ).toBe('appCallback');
    }
  });

  it('không đụng các path khác, kể cả khi body mang nexora://', () => {
    expect(
      mobileAuthRejection({
        path: '/request-password-reset',
        body: { email: 'a@b.c', redirectTo: 'nexora://reset-password' },
      }),
    ).toBeNull();
    expect(mobileAuthRejection({ path: '/sign-in/email', body: undefined })).toBeNull();
  });

  it('mỗi lý do có thông điệp riêng, giữ đúng chữ của lỗi gốc Better Auth và plugin', () => {
    expect(MOBILE_AUTH_REJECTION_MESSAGES).toEqual({
      authorizationProxy: 'Invalid authorizationURL',
      appCallback: 'Invalid callbackURL',
    });
  });
});
