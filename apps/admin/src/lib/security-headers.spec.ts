import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from './security-headers';

// ADR-0038 §3 + AMEND 1 — CSP admin nonce + 'strict-dynamic' (nghiêm hơn
// web vì admin dynamic từng request và là đích giá trị nhất); allowlist HẸP
// hơn web. So BẰNG từng directive để ai nhét thêm host lặng lẽ là đỏ.
const NONCE = 'dGVzdC1ub25jZS0xMjM0';
// W4 C2 (ADR-0038 AMEND 2): reportUri = endpoint nhận báo cáo ở API — cùng
// một nơi với web.
const DEV = buildSecurityHeaders({
  apiOrigin: 'http://localhost:3001',
  isDev: true,
  nonce: NONCE,
  reportUri: 'http://localhost:3001/api/webhooks/csp-report',
});
const PROD = buildSecurityHeaders({
  apiOrigin: 'https://api.nexora-travel.agency',
  isDev: false,
  nonce: NONCE,
  reportUri: 'https://api.nexora-travel.agency/api/webhooks/csp-report',
});

function parseCsp(headers: { key: string; value: string }[]): Record<string, string> {
  const csp = headers.find((h) => h.key === 'Content-Security-Policy');
  expect(csp).toBeDefined();
  return Object.fromEntries(
    (csp?.value ?? '').split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name, sources.join(' ')];
    }),
  );
}

const PROD_EXPECTED: Record<string, string> = {
  'default-src': "'self'",
  'script-src': `'self' 'nonce-${NONCE}' 'strict-dynamic'`,
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
  'font-src': "'self'",
  'connect-src': "'self' https://api.nexora-travel.agency",
  'frame-src': "'none'",
  'frame-ancestors': "'none'",
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  'manifest-src': "'self'",
  'media-src': "'self'",
  // W4 C2: kênh báo cáo — report-to (Reporting API) + report-uri (fallback).
  'report-to': 'csp',
  'report-uri': 'https://api.nexora-travel.agency/api/webhooks/csp-report',
  'upgrade-insecure-requests': '',
};

describe('buildSecurityHeaders (admin)', () => {
  it('production: đúng bộ directive đã chốt — hẹp hơn web: không map, không upload thẳng, không worker', () => {
    const prod = parseCsp(PROD);
    expect(prod).toEqual(PROD_EXPECTED);
    expect('worker-src' in prod).toBe(false);
  });

  it("script-src mang nonce ĐÚNG MỘT LẦN + 'strict-dynamic'", () => {
    const csp = PROD.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp.split(`'nonce-${NONCE}'`).length - 1).toBe(1);
  });

  it("dev: 'unsafe-eval' đúng trong script-src, connect-src localhost, KHÔNG upgrade-insecure-requests", () => {
    const dev = parseCsp(DEV);
    expect(dev).toEqual({
      ...PROD_EXPECTED,
      'script-src': `'self' 'nonce-${NONCE}' 'strict-dynamic' 'unsafe-eval'`,
      'connect-src': "'self' http://localhost:3001",
      'report-uri': 'http://localhost:3001/api/webhooks/csp-report',
      'upgrade-insecure-requests': undefined,
    });
    expect('upgrade-insecure-requests' in dev).toBe(false);
  });

  it('kèm 5 header ngoài CSP (X-Robots-Tag noindex toàn admin), KHÔNG Strict-Transport-Security', () => {
    const map = new Map(PROD.map((h) => [h.key, h.value]));
    expect(map.get('X-Content-Type-Options')).toBe('nosniff');
    expect(map.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(map.get('X-Frame-Options')).toBe('DENY');
    expect(map.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(map.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(PROD.map((h) => h.key)).toHaveLength(7);
    expect(PROD.some((h) => h.key.toLowerCase() === 'strict-transport-security')).toBe(false);
  });

  it('W4 C2: phát Reporting-Endpoints trỏ endpoint csp-report của API', () => {
    const map = new Map(PROD.map((h) => [h.key, h.value]));
    expect(map.get('Reporting-Endpoints')).toBe(
      'csp="https://api.nexora-travel.agency/api/webhooks/csp-report"',
    );
  });

  it('CSP là một dòng, không khoảng trắng đôi', () => {
    const csp = PROD.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).not.toMatch(/\s{2}|\n/);
  });
});
