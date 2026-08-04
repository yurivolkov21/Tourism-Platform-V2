import { type NextRequest, NextResponse } from 'next/server';

/**
 * Chặn sớm khu /account cho khách chưa đăng nhập (ADR-0017 §3 — port matcher
 * hẹp của Nexora). CHỈ kiểm cookie session TỒN TẠI — xác thực thật nằm ở
 * từng page (requireSession, defense-in-depth). Đây KHÔNG phải tầng bảo mật;
 * đừng thêm logic gì vào đây. `/tours/:slug/book` sẽ thêm ở cụm C.
 *
 * Tên cookie đối chiếu THẬT (`node_modules/better-auth/dist/cookies/index.mjs`
 * bản 1.6.23, hàm `createCookieGetter`): `${secureCookiePrefix}${prefix}.
 * session_token` với `prefix` mặc định `better-auth` — API chưa khai
 * `advanced.cookiePrefix`/`advanced.cookies` riêng (`auth.config.ts`) nên
 * đúng default. `secureCookiePrefix` (`__Secure-`) CHỈ gắn khi baseURL https
 * — dev http nên tên trần `better-auth.session_token`, khớp brief.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('better-auth.session_token');
  if (!hasSession) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/account/:path*'] };
