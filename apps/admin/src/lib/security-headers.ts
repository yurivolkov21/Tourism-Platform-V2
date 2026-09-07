/**
 * Security header + CSP của apps/admin (ADR-0038 §3) — hàm THUẦN, `proxy.ts`
 * chỉ gọi (proxy sinh nonce mỗi request rồi đặt CSP vào CẢ request header lẫn
 * response — nếp guide "Content Security Policy" của Next: Next đọc nonce từ
 * request header để gắn vào script của chính nó lúc SSR).
 *
 * ⚠️ File này CỐ Ý riêng cho admin, KHÔNG gom chung với
 * `apps/web/src/lib/security-headers.ts` (ADR-0038 §4): allowlist khác nhau
 * về bản chất — admin có nonce + 'strict-dynamic', KHÔNG có bản đồ
 * (OpenFreeMap/worker) và KHÔNG upload thẳng Cloudinary; một gói chung sẽ
 * thành nơi người sau "thêm origin cho cả hai" mà không nghĩ. Thêm origin
 * mới PHẢI qua AMEND ADR-0038 trước.
 */

export interface SecurityHeaderInput {
  /** Origin API mà browser admin gọi (Better Auth client) — origin trần. */
  apiOrigin: string;
  /** Dev cần 'unsafe-eval' (React eval dựng server stack) và không ép https. */
  isDev: boolean;
  /** Nonce 16 byte base64 do proxy sinh MỚI mỗi request. */
  nonce: string;
}

export interface HeaderEntry {
  key: string;
  value: string;
}

function buildCsp({ apiOrigin, isDev, nonce }: SecurityHeaderInput): string {
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic': script mang nonce được quyền nạp tiếp chunk của Next;
    // browser hiểu strict-dynamic sẽ bỏ qua 'self'.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // recharts/chart.tsx chèn <style> — đo được (ADR-0038 §3).
    "style-src 'self' 'unsafe-inline'",
    // Avatar admin (nav-user) do Cloudinary phục vụ; data:/blob: cho preview.
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self'",
    // Chỉ API: mọi ghi đi qua server action, browser chỉ còn Better Auth.
    `connect-src 'self' ${apiOrigin}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
  ];
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/**
 * Bộ header cho mọi response admin. KHÔNG có Strict-Transport-Security —
 * Vercel đã tự gắn (đo 07/09, ADR-0038 §1).
 */
export function buildSecurityHeaders(input: SecurityHeaderInput): HeaderEntry[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(input) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ];
}
