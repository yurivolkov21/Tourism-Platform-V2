import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

// Chép khuôn apps/web/src/proxy.spec.ts (I-1: kiểm CẢ HAI tên cookie) + phần
// riêng admin: CSP nonce (ADR-0038 §3 / ADR-0026 AMEND 3) phải nằm ở CẢ
// response LẪN request header — Next đọc nonce từ request header để gắn vào
// script của chính nó, thiếu một bên là script bị chặn trắng trang.

function nonceOf(csp: string | null): string {
  const match = csp?.match(/'nonce-([A-Za-z0-9+/=]+)'/);
  // toBeTruthy chứ không not.toBeNull: csp null cho ra undefined, mà
  // undefined vẫn "không phải null" — đã dính khi viết ca đỏ đầu tiên.
  expect(match?.[1]).toBeTruthy();
  return match?.[1] ?? '';
}

describe('proxy (admin)', () => {
  it('redirect về /login kèm ?redirect= khi không có cookie session nào', () => {
    const request = new NextRequest('https://admin.example.com/bookings');

    const response = proxy(request);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirect')).toBe('/bookings');
  });

  it('cho qua khi có cookie session (cả tên trần lẫn __Secure-)', () => {
    for (const cookie of [
      'better-auth.session_token=abc',
      '__Secure-better-auth.session_token=abc',
    ]) {
      const response = proxy(
        new NextRequest('https://admin.example.com/', { headers: { cookie } }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    }
  });

  it('cho qua public path /login và /not-authorized khi chưa đăng nhập', () => {
    for (const path of ['/login', '/not-authorized']) {
      const response = proxy(new NextRequest(`https://admin.example.com${path}`));
      expect(response.status).toBe(200);
    }
  });

  it('response mang CSP có nonce + strict-dynamic, và request header cũng mang đúng CSP đó', () => {
    const response = proxy(
      new NextRequest('https://admin.example.com/', {
        headers: { cookie: 'better-auth.session_token=abc' },
      }),
    );

    const csp = response.headers.get('content-security-policy');
    const nonce = nonceOf(csp);
    expect(csp).toContain("'strict-dynamic'");
    // NextResponse.next({ request }) ghi header forward vào cặp
    // x-middleware-request-* — đường duy nhất quan sát được từ test.
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
  });

  it('forward x-pathname để layout gác biết path thật (W3-O6, ADR-0026 AMEND 3 §B)', () => {
    const response = proxy(
      new NextRequest('https://admin.example.com/bookings/BK-1', {
        headers: { cookie: 'better-auth.session_token=abc' },
      }),
    );
    expect(response.headers.get('x-middleware-request-x-pathname')).toBe('/bookings/BK-1');
  });

  it('nonce phải có mặt cả ở public path /login (matcher không chừa)', () => {
    const response = proxy(new NextRequest('https://admin.example.com/login'));
    nonceOf(response.headers.get('content-security-policy'));
  });

  it('nonce MỚI mỗi request — hai request không trùng nonce', () => {
    const make = () =>
      nonceOf(
        proxy(
          new NextRequest('https://admin.example.com/', {
            headers: { cookie: 'better-auth.session_token=abc' },
          }),
        ).headers.get('content-security-policy'),
      );
    expect(make()).not.toBe(make());
  });

  it('kèm các header ngoài CSP (nosniff…) trên response', () => {
    const response = proxy(
      new NextRequest('https://admin.example.com/', {
        headers: { cookie: 'better-auth.session_token=abc' },
      }),
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });
});
