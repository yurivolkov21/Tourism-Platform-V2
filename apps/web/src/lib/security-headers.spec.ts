import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from './security-headers';

// ADR-0038 §1 + AMEND 1 — CSP web không nonce + 4 header ngoài CSP. So BẰNG
// từng directive (map directive → sources) chứ không `toContain`: CSP sai là
// prod hỏng NGAY sau push (spec W3 §6), và ADR bắt mọi origin mới phải qua
// AMEND — test phải đỏ khi ai đó nhét thêm host lặng lẽ.
// W4 C2 (ADR-0038 AMEND 2): reportUri = endpoint nhận báo cáo ở API — hai
// app cùng trỏ một nơi.
const DEV = buildSecurityHeaders({
  apiOrigin: 'http://localhost:3001',
  isDev: true,
  reportUri: 'http://localhost:3001/api/webhooks/csp-report',
});
const PROD = buildSecurityHeaders({
  apiOrigin: 'https://api.nexora-travel.agency',
  isDev: false,
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
  'script-src': "'self' 'unsafe-inline'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src':
    "'self' data: blob: https://res.cloudinary.com https://tiles.openfreemap.org https://lh3.googleusercontent.com",
  'font-src': "'self'",
  'connect-src':
    "'self' https://api.nexora-travel.agency https://tiles.openfreemap.org https://api.cloudinary.com",
  'worker-src': "'self' blob:",
  // `'self'` trong child-src là BẮT BUỘC, không phải thừa: child-src là fallback
  // cho browser chưa hiểu worker-src, và từ maplibre 6 worker nạp từ URL
  // same-origin `/maplibre/maplibre-gl-worker.mjs` chứ không còn từ `blob:`.
  // Thiếu `'self'` thì đúng những browser đó chặn worker và bản đồ /contact
  // trắng IM LẶNG — bẫy không lộ khi tự kiểm bằng Chrome mới (ADR-0018 AMEND 2).
  'child-src': "'self' blob:",
  'frame-src': "'none'",
  'frame-ancestors': "'none'",
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  'manifest-src': "'self'",
  'media-src': "'self' https://res.cloudinary.com",
  // W4 C2: kênh báo cáo — report-to (Reporting API) + report-uri (fallback
  // browser cũ), cùng trỏ endpoint ở API.
  'report-to': 'csp',
  'report-uri': 'https://api.nexora-travel.agency/api/webhooks/csp-report',
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
      'report-uri': 'http://localhost:3001/api/webhooks/csp-report',
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
    expect(PROD.map((h) => h.key)).toHaveLength(6);
  });

  it('W4 C2: phát Reporting-Endpoints trỏ endpoint csp-report của API', () => {
    const map = new Map(PROD.map((h) => [h.key, h.value]));
    expect(map.get('Reporting-Endpoints')).toBe(
      'csp="https://api.nexora-travel.agency/api/webhooks/csp-report"',
    );
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
