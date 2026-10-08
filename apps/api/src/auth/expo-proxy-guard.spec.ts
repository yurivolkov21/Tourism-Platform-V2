import { describe, expect, it } from 'vitest';
import { isAllowedExpoAuthorizationUrl } from './expo-proxy-guard.js';

const allow = {
  googleClientId: 'client-123.apps.googleusercontent.com',
  authBaseUrl: 'https://api.nexora-travel.agency/api/auth',
};

/** URL hợp lệ đúng như BA dựng cho Google (create-authorization-url). */
function googleUrl(overrides: Record<string, string | null> = {}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const params: Record<string, string | null> = {
    response_type: 'code',
    client_id: allow.googleClientId,
    state: 'abc',
    scope: 'email profile openid',
    redirect_uri: `${allow.authBaseUrl}/callback/google`,
    ...overrides,
  };
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

describe('isAllowedExpoAuthorizationUrl (B2 — chặn open redirect của expo-authorization-proxy)', () => {
  it('nhận URL Google đúng endpoint, đúng client_id, redirect_uri về callback của mình', () => {
    expect(isAllowedExpoAuthorizationUrl(googleUrl(), allow)).toBe(true);
  });

  it('chặn host bất kỳ khác Google — lỗ open redirect gốc', () => {
    expect(isAllowedExpoAuthorizationUrl('https://evil.example/phish', allow)).toBe(false);
    expect(
      isAllowedExpoAuthorizationUrl(
        googleUrl().replace('accounts.google.com', 'accounts.google.com.evil.example'),
        allow,
      ),
    ).toBe(false);
  });

  it('chặn path khác trên accounts.google.com (vd trang có `continue=` chuyển tiếp tiếp)', () => {
    const url = new URL(googleUrl());
    url.pathname = '/Logout';
    url.searchParams.set('continue', 'https://evil.example');
    expect(isAllowedExpoAuthorizationUrl(url.toString(), allow)).toBe(false);
  });

  it('chặn http, userinfo trong URL, và chuỗi không phải URL', () => {
    expect(isAllowedExpoAuthorizationUrl(googleUrl().replace('https:', 'http:'), allow)).toBe(
      false,
    );
    expect(
      isAllowedExpoAuthorizationUrl(googleUrl().replace('https://', 'https://user:pass@'), allow),
    ).toBe(false);
    expect(isAllowedExpoAuthorizationUrl('not a url', allow)).toBe(false);
  });

  it('chặn client_id lạ — không làm proxy cho app OAuth của kẻ khác', () => {
    expect(
      isAllowedExpoAuthorizationUrl(
        googleUrl({ client_id: 'attacker.apps.googleusercontent.com' }),
        allow,
      ),
    ).toBe(false);
    expect(isAllowedExpoAuthorizationUrl(googleUrl({ client_id: null }), allow)).toBe(false);
  });

  it('chặn redirect_uri không về đúng callback Google của API', () => {
    expect(
      isAllowedExpoAuthorizationUrl(googleUrl({ redirect_uri: 'https://evil.example/cb' }), allow),
    ).toBe(false);
    expect(
      isAllowedExpoAuthorizationUrl(
        googleUrl({ redirect_uri: `${allow.authBaseUrl}/callback/github` }),
        allow,
      ),
    ).toBe(false);
    expect(isAllowedExpoAuthorizationUrl(googleUrl({ redirect_uri: null }), allow)).toBe(false);
  });

  it('Google chưa cấu hình (không có client id) → chặn hết', () => {
    expect(
      isAllowedExpoAuthorizationUrl(googleUrl(), { ...allow, googleClientId: undefined }),
    ).toBe(false);
  });

  it('authBaseUrl có dấu / cuối vẫn so đúng', () => {
    expect(
      isAllowedExpoAuthorizationUrl(googleUrl(), {
        ...allow,
        authBaseUrl: `${allow.authBaseUrl}/`,
      }),
    ).toBe(true);
  });
});
