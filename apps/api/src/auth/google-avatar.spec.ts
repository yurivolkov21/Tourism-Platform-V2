import { describe, expect, it } from 'vitest';
import { googleSignInAvatar, isGoogleProfileImageUrl } from './google-avatar.js';

const GOOGLE_PHOTO = 'https://lh3.googleusercontent.com/a/ACg8ocJ-abc123=s96-c';

describe('isGoogleProfileImageUrl', () => {
  it('nhận ảnh hồ sơ Google trên lh3.googleusercontent.com', () => {
    expect(isGoogleProfileImageUrl(GOOGLE_PHOTO)).toBe(true);
  });

  it('chặn host khác, http, userinfo và host giả dạng', () => {
    for (const value of [
      'http://lh3.googleusercontent.com/a/x',
      'https://lh5.googleusercontent.com/a/x',
      'https://lh3.googleusercontent.com.evil.example/a/x',
      'https://evil.example/lh3.googleusercontent.com/a/x',
      'https://user:pass@lh3.googleusercontent.com/a/x',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(isGoogleProfileImageUrl(value)).toBe(false);
    }
  });
});

describe('googleSignInAvatar (ảnh Google lúc tạo user qua đăng nhập Google)', () => {
  it('giữ ảnh Google trên nhánh ID token của app và callback của web', () => {
    expect(googleSignInAvatar(GOOGLE_PHOTO, '/sign-in/social')).toEqual({ image: GOOGLE_PHOTO });
    expect(googleSignInAvatar(GOOGLE_PHOTO, '/callback/:id')).toEqual({ image: GOOGLE_PHOTO });
  });

  it('bỏ ảnh (null) thay vì từ chối khi Google trả host lạ — đăng nhập không được hỏng vì ảnh', () => {
    expect(googleSignInAvatar('https://lh5.googleusercontent.com/a/x', '/sign-in/social')).toEqual({
      image: null,
    });
    expect(googleSignInAvatar(42, '/callback/:id')).toEqual({ image: null });
  });

  it('không áp ngoài đường đăng nhập Google — guard chung vẫn từ chối như cũ', () => {
    expect(googleSignInAvatar(GOOGLE_PHOTO, '/sign-up/email')).toBeUndefined();
    expect(googleSignInAvatar(GOOGLE_PHOTO, '/update-user')).toBeUndefined();
    expect(googleSignInAvatar(GOOGLE_PHOTO, undefined)).toBeUndefined();
  });
});
