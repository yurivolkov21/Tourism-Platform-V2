import { describe, expect, it } from 'vitest';
import { fieldOfAuthError, mapAuthError } from './auth-errors';

describe('mapAuthError', () => {
  it('status 401 -> invalidCredentials', () => {
    expect(mapAuthError({ status: 401 })).toBe('invalidCredentials');
  });

  it('status 422 -> emailExists', () => {
    expect(mapAuthError({ status: 422 })).toBe('emailExists');
  });

  it('code chứa EXISTS -> emailExists (kể cả khi status khác 422)', () => {
    expect(mapAuthError({ status: 400, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe(
      'emailExists',
    );
  });

  it('status 429 -> tooManyRequests', () => {
    expect(mapAuthError({ status: 429 })).toBe('tooManyRequests');
  });

  it('code chứa ATTEMPTS -> tooManyRequests (OTP sai quá 5 lần, BA trả FORBIDDEN không phải 429)', () => {
    expect(mapAuthError({ status: 403, code: 'TOO_MANY_ATTEMPTS' })).toBe('tooManyRequests');
  });

  it('code chứa OTP -> invalidOtp', () => {
    expect(mapAuthError({ status: 400, code: 'INVALID_OTP' })).toBe('invalidOtp');
    expect(mapAuthError({ status: 400, code: 'OTP_EXPIRED' })).toBe('invalidOtp');
  });

  it('code chứa TOKEN -> invalidToken', () => {
    expect(mapAuthError({ status: 400, code: 'INVALID_TOKEN' })).toBe('invalidToken');
    expect(mapAuthError({ status: 400, code: 'TOKEN_EXPIRED' })).toBe('invalidToken');
  });

  it('status 404 -> notAvailable', () => {
    expect(mapAuthError({ status: 404 })).toBe('notAvailable');
  });

  it('status 501 -> notAvailable', () => {
    expect(mapAuthError({ status: 501 })).toBe('notAvailable');
  });

  it('còn lại (status/code không khớp) -> generic', () => {
    expect(mapAuthError({ status: 500 })).toBe('generic');
    expect(mapAuthError({ status: 400, code: 'BAD_REQUEST' })).toBe('generic');
  });

  it('null hoặc undefined -> generic', () => {
    expect(mapAuthError(null)).toBe('generic');
    expect(mapAuthError(undefined)).toBe('generic');
  });

  // Sweep 19/08: mã BA nói rõ ô nào sai — không gom vào generic nữa.
  it('code INVALID_EMAIL (400) -> invalidEmail', () => {
    expect(mapAuthError({ status: 400, code: 'INVALID_EMAIL' })).toBe('invalidEmail');
  });

  it('code PASSWORD_TOO_SHORT / PASSWORD_TOO_LONG -> passwordTooShort / passwordTooLong', () => {
    expect(mapAuthError({ status: 400, code: 'PASSWORD_TOO_SHORT' })).toBe('passwordTooShort');
    expect(mapAuthError({ status: 400, code: 'PASSWORD_TOO_LONG' })).toBe('passwordTooLong');
  });

  it('code INVALID_PASSWORD (đổi mật khẩu, mật khẩu hiện tại sai) -> wrongCurrentPassword', () => {
    expect(mapAuthError({ status: 400, code: 'INVALID_PASSWORD' })).toBe('wrongCurrentPassword');
  });

  it('code CREDENTIAL_ACCOUNT_NOT_FOUND (tài khoản chỉ Google) -> noPasswordAccount', () => {
    expect(mapAuthError({ status: 400, code: 'CREDENTIAL_ACCOUNT_NOT_FOUND' })).toBe(
      'noPasswordAccount',
    );
  });

  it('401 vẫn thắng dù code là INVALID_EMAIL_OR_PASSWORD (không lộ ô nào sai khi đăng nhập)', () => {
    expect(mapAuthError({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'invalidCredentials',
    );
  });
});

describe('fieldOfAuthError', () => {
  it('lỗi thuộc ô email -> email', () => {
    expect(fieldOfAuthError('invalidEmail')).toBe('email');
    expect(fieldOfAuthError('emailExists')).toBe('email');
  });

  it('lỗi thuộc ô mật khẩu (mới) -> password', () => {
    expect(fieldOfAuthError('passwordTooShort')).toBe('password');
    expect(fieldOfAuthError('passwordTooLong')).toBe('password');
  });

  it('mật khẩu hiện tại sai -> currentPassword', () => {
    expect(fieldOfAuthError('wrongCurrentPassword')).toBe('currentPassword');
  });

  it('lỗi cấp form (không quy được cho ô nào) -> null', () => {
    expect(fieldOfAuthError('invalidCredentials')).toBeNull();
    expect(fieldOfAuthError('tooManyRequests')).toBeNull();
    expect(fieldOfAuthError('generic')).toBeNull();
    expect(fieldOfAuthError('noPasswordAccount')).toBeNull();
  });
});
