/**
 * Security header + CSP của apps/web (ADR-0038 §1) — hàm THUẦN để test được ở
 * project node; `next.config.ts` chỉ gọi qua `headers()`.
 *
 * ⚠️ File này CỐ Ý riêng cho web, KHÔNG gom chung với
 * `apps/admin/src/lib/security-headers.ts` (ADR-0038 §4): allowlist hai app
 * khác nhau về bản chất (web có bản đồ OpenFreeMap + upload thẳng Cloudinary,
 * admin có nonce) — một gói chung sẽ thành nơi người sau "thêm origin cho cả
 * hai" mà không nghĩ. Thêm origin mới PHẢI qua AMEND ADR-0038 trước.
 */

export interface SecurityHeaderInput {
  /** Origin API mà BROWSER gọi (connect-src) — origin trần, không kèm /api. */
  apiOrigin: string;
  /** Dev cần 'unsafe-eval' (React eval dựng server stack) và không được ép https. */
  isDev: boolean;
}

export interface HeaderEntry {
  key: string;
  value: string;
}

/**
 * CSP không nonce: mọi trang web là SSG/ISR nên nonce đòi bỏ ISR toàn site
 * (ADR-0038 §1 ghi trọn lý do + giá trị còn lại). Danh sách origin ngoài là
 * kết quả grep 07/09 đã phân loại ở ADR-0038 §2.
 */
function buildCsp({ apiOrigin, isDev }: SecurityHeaderInput): string {
  const directives = [
    "default-src 'self'",
    // 'unsafe-inline': theme script + <noscript><style> ở root layout, style
    // attr do motion render trong HTML SSR, <style> của chart.tsx.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // data:/blob:: placeholder + preview upload; hai host: ảnh Cloudinary +
    // tile/sprite bản đồ.
    "img-src 'self' data: blob: https://res.cloudinary.com https://tiles.openfreemap.org",
    // next/font tự host — runtime không có fonts.googleapis.com.
    "font-src 'self'",
    // OpenFreeMap: style JSON kéo tiles/glyph/sprite cùng host qua fetch;
    // api.cloudinary.com: browser POST thẳng file đã ký (media-upload.ts).
    `connect-src 'self' ${apiOrigin} https://tiles.openfreemap.org https://api.cloudinary.com`,
    // MapLibre 5.24 tạo Web Worker từ blob: — thiếu là bản đồ /contact trắng
    // im lặng; child-src là fallback cho browser chưa hiểu worker-src.
    "worker-src 'self' blob:",
    'child-src blob:',
    // Stripe/PayPal là điều hướng top-level, không iframe nào trong app.
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
  ];
  // Chỉ production — dev http://localhost bị tự nâng https là chết.
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/**
 * Bộ header cho MỌI route ('/:path*'). KHÔNG có Strict-Transport-Security —
 * Vercel đã tự gắn max-age=63072000 (đo 07/09), gắn đôi là hai giá trị chỏi
 * nhau khi Vercel đổi (ADR-0038 §1).
 */
export function buildSecurityHeaders(input: SecurityHeaderInput): HeaderEntry[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(input) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Cắt đường rò ?token= của /reset-password qua referrer sang origin khác.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Legacy song song frame-ancestors — browser cũ.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ];
}
