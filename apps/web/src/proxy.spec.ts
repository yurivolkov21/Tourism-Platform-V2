import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

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

  it('giữ nguyên query trong ?redirect= — đợt đã chọn ở trang tour không mất qua lượt đăng nhập (W-02)', () => {
    const request = new NextRequest(
      'https://example.com/tours/ha-giang-loop-4d/book?departure=11111111-1111-4111-8111-111111111111',
    );

    const response = proxy(request);

    const location = new URL(response.headers.get('location') ?? '');
    expect(location.searchParams.get('redirect')).toBe(
      '/tours/ha-giang-loop-4d/book?departure=11111111-1111-4111-8111-111111111111',
    );
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

describe('config.matcher (ADR-0062)', () => {
  it('trang chuyển tiếp về app nằm ngoài matcher — khách app không có cookie web', () => {
    expect(config.matcher).not.toContain('/checkout/:path*');
    expect(config.matcher).not.toContain('/checkout/app-return');
    expect(config.matcher).toEqual(
      expect.arrayContaining(['/checkout/success', '/checkout/cancel']),
    );
  });
});
