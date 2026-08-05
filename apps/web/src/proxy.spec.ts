import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

// I-1: proxy phải nhận CẢ HAI tên cookie session — tên trần (dev http) và
// tên có prefix `__Secure-` (prod https, Better Auth tự gắn khi baseURL
// https — xem JSDoc trong proxy.ts). Thiếu case 3 khiến user đã đăng nhập
// trên prod bị đá về /login (bug gốc của I-1).
describe('proxy', () => {
  it('redirect về /login kèm ?redirect= khi không có cookie session nào', () => {
    const request = new NextRequest('https://example.com/account');

    const response = proxy(request);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirect')).toBe('/account');
  });

  it('cho qua khi có cookie tên trần better-auth.session_token (dev http)', () => {
    const request = new NextRequest('https://example.com/account', {
      headers: { cookie: 'better-auth.session_token=abc' },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('cho qua khi có cookie tên __Secure-better-auth.session_token (prod https)', () => {
    const request = new NextRequest('https://example.com/account', {
      headers: { cookie: '__Secure-better-auth.session_token=abc' },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
