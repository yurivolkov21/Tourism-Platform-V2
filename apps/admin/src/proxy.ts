import { type NextRequest, NextResponse } from 'next/server';
import { decideAdminAccess } from '@/lib/admin-gate';
import { browserApiOrigin } from '@/lib/api/env';
import { buildSecurityHeaders } from '@/lib/security-headers';

/**
 * Chặn sớm TOÀN BỘ admin cho khách chưa đăng nhập (spec P4a §2). Tầng này
 * CHỈ kiểm cookie session TỒN TẠI — cùng nếp proxy của web (ADR-0017 §3):
 * xác thực + kiểm role thật nằm ở layout (admin) qua `getServerSession` +
 * `decideAdminAccess` (defense-in-depth, không nhân đôi verify của Better
 * Auth ở edge). Kiểm CẢ HAI tên cookie — dev http tên trần, prod https có
 * prefix `__Secure-` (bài học I-1 của web: thiếu tên thứ hai là user prod
 * bị đá về /login dù đã đăng nhập).
 *
 * ⚠️ LUẬT (ADR-0026 AMEND 3 §C): proxy KHÔNG phải biên quyền. Nó chỉ chặn
 * sớm cho đỡ một round-trip; mọi quyết định quyền thật nằm ở layout gác +
 * AuthGuard/@Roles của API. Audit 05/09 cụm 8 đã chỉ: POST `Next-Action`
 * tới path public vẫn chạy action (API trả 401, không leo thang) — chấp
 * nhận, ĐỪNG vá bằng cách nhét thêm luật quyền vào đây.
 *
 * Từ W3 proxy kiêm thêm việc CSP (ADR-0038 §3): sinh nonce mỗi request và
 * đặt CSP vào CẢ request header (Next đọc nonce từ đó để gắn vào script của
 * chính nó lúc SSR — nếp guide "Content Security Policy") LẪN response
 * header (thứ browser thực thi). Thiếu một bên là trắng trang.
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

  // Nonce 16 byte, MỚI mỗi request — đoán được nonce là vô hiệu CSP.
  // btoa + getRandomValues: có mặt ở cả Node lẫn edge runtime.
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const securityHeaders = buildSecurityHeaders({
    // connect-src cho browser (Better Auth client) — CÙNG resolver với
    // authClient (vòng vá review W3): đọc env thô ở đây từng cho CSP nhận
    // path thừa/localhost trong khi authClient gọi đúng origin; nay thiếu env
    // hay không https ở production là throw → mọi request 500 ồn ào (đúng ý
    // fail-closed ADR-0003) thay vì login chết im vì CSP.
    apiOrigin: browserApiOrigin(),
    isDev: process.env.NODE_ENV === 'development',
    nonce,
    // W4 C2 (ADR-0038 AMEND 2): báo cáo CSP về API — một endpoint cho cả
    // hai app, ghép từ cùng resolver với connect-src.
    reportUri: `${browserApiOrigin()}/api/webhooks/csp-report`,
  });

  let response: NextResponse;
  if (decision.kind === 'login') {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', decision.redirectTo);
    response = NextResponse.redirect(login);
  } else {
    // Forward CSP + nonce vào request để Next gắn nonce lên script của nó.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    // Path thật (kèm query để ?redirect= giữ được bộ lọc) cho layout gác
    // (W3-O6): Next không cho layout đọc pathname, proxy là chỗ duy nhất biết
    // — layout đọc x-pathname, fallback '/'. PHẢI là `.set` (ghi ĐÈ): Next
    // KHÔNG xoá header client gửi lên, `has`-rồi-bỏ-qua là để kẻ tấn công
    // tự khai path (proxy.spec canh ca này). Header proxy→app CHỈ mang dữ
    // liệu định tuyến/hiển thị, không bao giờ mang phán quyết quyền
    // (ADR-0026 AMEND 4).
    requestHeaders.set('x-pathname', `${path}${request.nextUrl.search}`);
    for (const { key, value } of securityHeaders) {
      if (key === 'Content-Security-Policy') requestHeaders.set(key, value);
    }
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  // Response nào (kể cả redirect) cũng mang đủ bộ header — rẻ và nhất quán.
  for (const { key, value } of securityHeaders) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  // Chặn mọi route TRỪ asset tĩnh của Next và favicon — admin không có
  // trang public nào ngoài /login + /not-authorized (hàm gate tự cho qua).
  // Matcher phủ cả hai path public là CỐ Ý: nonce CSP phải có mặt ở đó.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
