import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from './security-headers';

// ADR-0038 §3 — CSP admin nonce + 'strict-dynamic' (nghiêm hơn web vì admin
// dynamic từng request và là đích giá trị nhất); allowlist HẸP hơn web.
const NONCE = 'dGVzdC1ub25jZS0xMjM0';
const DEV = buildSecurityHeaders({
  apiOrigin: 'http://localhost:3001',
  isDev: true,
  nonce: NONCE,
});
const PROD = buildSecurityHeaders({
  apiOrigin: 'https://api.nexora-travel.agency',
  isDev: false,
  nonce: NONCE,
});

function cspOf(headers: { key: string; value: string }[]): string {
  const csp = headers.find((h) => h.key === 'Content-Security-Policy');
  expect(csp).toBeDefined();
  return csp?.value ?? '';
}

describe('buildSecurityHeaders (admin)', () => {
  it("script-src mang nonce ĐÚNG MỘT LẦN + 'strict-dynamic'", () => {
    const csp = cspOf(PROD);
    expect(csp).toContain(`script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`);
    expect(csp.split(`'nonce-${NONCE}'`).length - 1).toBe(1);
  });

  it('phát đủ các directive còn lại — allowlist hẹp: không map, không upload thẳng', () => {
    const csp = cspOf(PROD);
    expect(csp).toContain("default-src 'self'");
    // recharts/chart.tsx chèn <style> — đo được, không phải phòng hờ.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: https://res.cloudinary.com");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toContain("media-src 'self'");
    expect(csp).not.toContain('openfreemap');
    expect(csp).not.toContain('api.cloudinary.com');
    expect(csp).not.toContain('worker-src');
  });

  it('connect-src chỉ self + apiOrigin', () => {
    expect(cspOf(PROD)).toContain("connect-src 'self' https://api.nexora-travel.agency");
    expect(cspOf(DEV)).toContain("connect-src 'self' http://localhost:3001");
  });

  it("dev có 'unsafe-eval', prod không; prod có upgrade-insecure-requests, dev không", () => {
    expect(cspOf(DEV)).toContain("'unsafe-eval'");
    expect(cspOf(PROD)).not.toContain("'unsafe-eval'");
    expect(cspOf(PROD)).toContain('upgrade-insecure-requests');
    expect(cspOf(DEV)).not.toContain('upgrade-insecure-requests');
  });

  it('kèm 4 header ngoài CSP, KHÔNG Strict-Transport-Security (Vercel đã gắn)', () => {
    const map = new Map(PROD.map((h) => [h.key, h.value]));
    expect(map.get('X-Content-Type-Options')).toBe('nosniff');
    expect(map.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(map.get('X-Frame-Options')).toBe('DENY');
    expect(map.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(PROD.some((h) => h.key.toLowerCase() === 'strict-transport-security')).toBe(false);
  });

  it('X-Robots-Tag noindex toàn admin — back-office không có gì cho crawler (W3-H3)', () => {
    const map = new Map(PROD.map((h) => [h.key, h.value]));
    expect(map.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('CSP là một dòng, không khoảng trắng đôi', () => {
    expect(cspOf(PROD)).not.toMatch(/\s{2}|\n/);
  });
});
