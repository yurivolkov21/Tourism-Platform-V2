import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from './security-headers';

// ADR-0038 §1 + AMEND 1 — CSP web không nonce + 4 header ngoài CSP. So BẰNG
// từng directive (map directive → sources) chứ không `toContain`: CSP sai là
// prod hỏng NGAY sau push (spec W3 §6), và ADR bắt mọi origin mới phải qua
// AMEND — test phải đỏ khi ai đó nhét thêm host lặng lẽ.
const DEV = buildSecurityHeaders({ apiOrigin: 'http://localhost:3001', isDev: true });
const PROD = buildSecurityHeaders({ apiOrigin: 'https://api.nexora-travel.agency', isDev: false });

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
  'script-src': "'self' 'unsafe-inline'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src':
    "'self' data: blob: https://res.cloudinary.com https://tiles.openfreemap.org https://lh3.googleusercontent.com",
  'font-src': "'self'",
  'connect-src':
    "'self' https://api.nexora-travel.agency https://tiles.openfreemap.org https://api.cloudinary.com",
  'worker-src': "'self' blob:",
  'child-src': 'blob:',
  'frame-src': "'none'",
  'frame-ancestors': "'none'",
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  'manifest-src': "'self'",
  'media-src': "'self' https://res.cloudinary.com",
  'upgrade-insecure-requests': '',
};

describe('buildSecurityHeaders (web)', () => {
  it('production: đúng bộ directive đã chốt — không thừa, không thiếu, không host lạ', () => {
    expect(parseCsp(PROD)).toEqual(PROD_EXPECTED);
  });

  it("dev: 'unsafe-eval' nằm đúng trong script-src, connect-src mang localhost, KHÔNG upgrade-insecure-requests", () => {
    const dev = parseCsp(DEV);
    expect(dev).toEqual({
      ...PROD_EXPECTED,
      'script-src': "'self' 'unsafe-inline' 'unsafe-eval'",
      'connect-src':
        "'self' http://localhost:3001 https://tiles.openfreemap.org https://api.cloudinary.com",
      'upgrade-insecure-requests': undefined,
    });
    expect('upgrade-insecure-requests' in dev).toBe(false);
  });

  it('media-src có Cloudinary — video khe about-cta-video, poster vẫn hiện nên thiếu là hỏng im lặng (AMEND 1)', () => {
    expect(parseCsp(PROD)['media-src']).toContain('https://res.cloudinary.com');
  });

  it('kèm 4 header ngoài CSP: nosniff, Referrer-Policy, XFO DENY, Permissions-Policy', () => {
    const map = new Map(PROD.map((h) => [h.key, h.value]));
    expect(map.get('X-Content-Type-Options')).toBe('nosniff');
    expect(map.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(map.get('X-Frame-Options')).toBe('DENY');
    expect(map.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(PROD.map((h) => h.key)).toHaveLength(5);
  });

  it('KHÔNG tự gắn Strict-Transport-Security — Vercel đã gắn (ADR-0038 §1)', () => {
    for (const headers of [DEV, PROD]) {
      expect(headers.some((h) => h.key.toLowerCase() === 'strict-transport-security')).toBe(false);
    }
  });

  it('CSP là một dòng, không thừa khoảng trắng đôi (header value hợp lệ)', () => {
    const csp = PROD.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).not.toMatch(/\s{2}|\n/);
  });
});
