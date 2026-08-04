import { describe, expect, it } from 'vitest';
import { withAuthHeaders, withAuthOptions, withNextOptions } from './client';

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

  it('browser (credentials include) → gắn credentials, KHÔNG ép cache', () => {
    const request = new Request('http://api.test/x');
    const init = withAuthOptions(request, { method: 'GET' }, { auth: { credentials: 'include' } });
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(init.cache).toBeUndefined();
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
