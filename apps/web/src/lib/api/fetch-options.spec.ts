import { describe, expect, it } from 'vitest';
import {
  INTERNAL_READ_KEY_HEADER,
  withAuthHeaders,
  withAuthOptions,
  withInternalReadKey,
  withNextOptions,
} from './client';

describe('withNextOptions', () => {
  it('gắn next.revalidate + tags từ client context vào RequestInit', () => {
    const init = withNextOptions({ method: 'GET' }, { next: { revalidate: 300, tags: ['posts'] } });
    expect(init).toMatchObject({ method: 'GET', next: { revalidate: 300, tags: ['posts'] } });
  });
  it('không context thì trả init nguyên vẹn (không thêm field next rỗng)', () => {
    expect(withNextOptions({ method: 'GET' }, undefined)).toEqual({ method: 'GET' });
  });
});

// ADR-0017 §3 — đường gọi authed (server cookie-forward + browser credentials).
describe('withAuthHeaders', () => {
  it('bọc cookie truyền vào thành context.auth dùng thẳng cho call oRPC', () => {
    expect(withAuthHeaders('better-auth.session_token=abc')).toEqual({
      auth: { cookie: 'better-auth.session_token=abc' },
    });
  });
});

describe('withAuthOptions', () => {
  it('context.auth rỗng → trả init nguyên vẹn (không đụng cache/credentials)', () => {
    const request = new Request('http://api.test/x');
    expect(withAuthOptions(request, { method: 'GET' }, undefined)).toEqual({ method: 'GET' });
  });

  it('browser (credentials include) → gắn credentials VÀ ép cache no-store (W3-O3: dữ liệu per-user không được vào HTTP cache/bfcache)', () => {
    const request = new Request('http://api.test/x');
    const init = withAuthOptions(request, { method: 'GET' }, { auth: { credentials: 'include' } });
    expect(init).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' });
  });

  it('server (forward cookie) → gắn header cookie + ép cache no-store, GIỮ header gốc của request', () => {
    const request = new Request('http://api.test/x', { headers: { accept: 'application/json' } });
    const init = withAuthOptions(
      request,
      { method: 'GET' },
      { auth: { cookie: 'better-auth.session_token=abc' } },
    );
    expect(init.cache).toBe('no-store');
    const headers = init.headers as Headers;
    expect(headers.get('cookie')).toBe('better-auth.session_token=abc');
    expect(headers.get('accept')).toBe('application/json');
  });
});

// ADR-0037 AMEND 2 (vòng vá review W4) — web SSR/build miễn bucket đọc bằng header nội bộ.
describe('withInternalReadKey', () => {
  const request = new Request('http://api.test/x', { headers: { accept: 'application/json' } });

  it('server + có key → gắn header, GIỮ header gốc (accept của oRPC) và header cookie đã forward', () => {
    const withCookie = withAuthOptions(
      request,
      { method: 'GET' },
      { auth: { cookie: 'better-auth.session_token=abc' } },
    );
    const init = withInternalReadKey(request, withCookie, 'internal-key-0123456789', 'server');
    const headers = new Headers(init.headers);
    expect(headers.get(INTERNAL_READ_KEY_HEADER)).toBe('internal-key-0123456789');
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('cookie')).toBe('better-auth.session_token=abc');
    expect(init.cache).toBe('no-store');
  });

  it('browser → KHÔNG BAO GIỜ gắn, kể cả khi key tồn tại (key lộ là mọi người đều nội bộ)', () => {
    expect(
      withInternalReadKey(request, { method: 'GET' }, 'internal-key-0123456789', 'browser'),
    ).toEqual({
      method: 'GET',
    });
  });

  it('server nhưng env trống/undefined → trả init nguyên vẹn', () => {
    expect(withInternalReadKey(request, { method: 'GET' }, undefined, 'server')).toEqual({
      method: 'GET',
    });
    expect(withInternalReadKey(request, { method: 'GET' }, '', 'server')).toEqual({
      method: 'GET',
    });
  });
});
