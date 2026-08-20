import { type NextRequest, NextResponse } from 'next/server';
import { decideAdminAccess } from '@/lib/admin-gate';

/**
 * Chặn sớm TOÀN BỘ admin cho khách chưa đăng nhập (spec P4a §2). Tầng này
 * CHỈ kiểm cookie session TỒN TẠI — cùng nếp proxy của web (ADR-0017 §3):
 * xác thực + kiểm role thật nằm ở layout (admin) qua `getServerSession` +
 * `decideAdminAccess` (defense-in-depth, không nhân đôi verify của Better
 * Auth ở edge). Kiểm CẢ HAI tên cookie — dev http tên trần, prod https có
 * prefix `__Secure-` (bài học I-1 của web: thiếu tên thứ hai là user prod
 * bị đá về /login dù đã đăng nhập).
 */
const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
] as const;

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasSession = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  // Dùng chung hàm quyết định với layout: coi "có cookie" như một session
  // role-chưa-biết — proxy chỉ đủ thẩm quyền trả lời nhánh `login`, nhánh
  // deny (role sai) là việc của layout sau khi hỏi API thật.
  const decision = decideAdminAccess(hasSession ? { role: 'ADMIN' } : null, path);
  if (decision.kind === 'login') {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', decision.redirectTo);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Chặn mọi route TRỪ asset tĩnh của Next và favicon — admin không có
  // trang public nào ngoài /login + /not-authorized (hàm gate tự cho qua).
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
