import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from './security-headers';

// ADR-0038 §1 — CSP web không nonce + 4 header ngoài CSP. Test đối chiếu
// từng directive vì CSP sai là prod hỏng NGAY sau push (spec W3 §6).
const DEV = buildSecurityHeaders({ apiOrigin: 'http://localhost:3001', isDev: true });
const PROD = buildSecurityHeaders({ apiOrigin: 'https://api.nexora-travel.agency', isDev: false });

function cspOf(headers: { key: string; value: string }[]): string {
  const csp = headers.find((h) => h.key === 'Content-Security-Policy');
  expect(csp).toBeDefined();
  return csp?.value ?? '';
}

describe('buildSecurityHeaders (web)', () => {
  it('phát đủ các directive CSP đã chốt ở ADR-0038 §1', () => {
    const csp = cspOf(PROD);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain(
      "img-src 'self' data: blob: https://res.cloudinary.com https://tiles.openfreemap.org",
    );
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain('child-src blob:');
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toContain("media-src 'self'");
  });

  it('connect-src mang apiOrigin truyền vào + OpenFreeMap + Cloudinary upload', () => {
    expect(cspOf(PROD)).toContain(
      "connect-src 'self' https://api.nexora-travel.agency https://tiles.openfreemap.org https://api.cloudinary.com",
    );
    expect(cspOf(DEV)).toContain("connect-src 'self' http://localhost:3001");
  });

  it("dev có 'unsafe-eval' (React eval dựng server stack), prod thì không", () => {
    expect(cspOf(DEV)).toContain("'unsafe-eval'");
    expect(cspOf(PROD)).not.toContain("'unsafe-eval'");
  });

  it('prod có upgrade-insecure-requests, dev không (http localhost bị ép https là chết)', () => {
    expect(cspOf(PROD)).toContain('upgrade-insecure-requests');
    expect(cspOf(DEV)).not.toContain('upgrade-insecure-requests');
  });

  it('kèm 4 header ngoài CSP: nosniff, Referrer-Policy, XFO DENY, Permissions-Policy', () => {
    const map = new Map(PROD.map((h) => [h.key, h.value]));
    expect(map.get('X-Content-Type-Options')).toBe('nosniff');
    expect(map.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(map.get('X-Frame-Options')).toBe('DENY');
    expect(map.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
  });

  it('KHÔNG tự gắn Strict-Transport-Security — Vercel đã gắn (ADR-0038 §1)', () => {
    for (const headers of [DEV, PROD]) {
      expect(headers.some((h) => h.key.toLowerCase() === 'strict-transport-security')).toBe(false);
    }
  });

  it('CSP là một dòng, không thừa khoảng trắng đôi (header value hợp lệ)', () => {
    expect(cspOf(PROD)).not.toMatch(/\s{2}|\n/);
  });
});
