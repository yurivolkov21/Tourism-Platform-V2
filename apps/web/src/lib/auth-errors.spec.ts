import { describe, expect, it } from 'vitest';
import { mapAuthError } from './auth-errors';

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
});
