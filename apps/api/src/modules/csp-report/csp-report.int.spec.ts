import { Logger } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { configureHttp, createFastifyAdapter } from '../../bootstrap.js';

/**
 * Integration W4 C1 (ADR-0038 AMEND 2): POST /api/webhooks/csp-report nhận
 * cả hai MIME của browser, KHÔNG dính hook 415 của W2, trần body 8 KB, log
 * một dòng cấu trúc có dedupe. App dựng qua configureHttp — parser
 * content-type của hai MIME sống ở đó.
 */

let app: NestFastifyApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    rawBody: true,
  });
  await configureHttp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

const post = (contentType: string, payload: string, ip = '10.7.0.1') =>
  app.inject({
    method: 'POST',
    url: '/api/webhooks/csp-report',
    remoteAddress: ip,
    headers: { 'content-type': contentType },
    payload,
  });

describe('POST /api/webhooks/csp-report (int)', () => {
  it('application/csp-report → 204 (KHÔNG 415 — hook W2 miễn /api/webhooks/), log MỘT dòng cấu trúc, lặp lại bị dedupe', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    try {
      const body = JSON.stringify({
        'csp-report': {
          'document-uri': 'http://localhost:3000/tours',
          'violated-directive': 'script-src-elem',
          'blocked-uri': 'https://evil.example/x.js',
        },
      });
      const first = await post('application/csp-report', body);
      expect(first.statusCode).toBe(204);

      const logged = warn.mock.calls.filter((c) => String(c[0]).startsWith('csp-report '));
      expect(logged).toHaveLength(1);
      expect(String(logged[0]?.[0])).toContain('"directive":"script-src-elem"');
      // Host localhost → app 'local' (appOf: www→web, admin→admin, còn lại local).
      expect(String(logged[0]?.[0])).toContain('"app":"local"');

      // Report Y HỆT lần hai trong cửa sổ 10′ → vẫn 204 nhưng KHÔNG log thêm.
      const second = await post('application/csp-report', body, '10.7.0.2');
      expect(second.statusCode).toBe(204);
      expect(warn.mock.calls.filter((c) => String(c[0]).startsWith('csp-report '))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('application/reports+json (report-to) → 204', async () => {
    const body = JSON.stringify([
      {
        type: 'csp-violation',
        body: {
          documentURL: 'http://localhost:3002/reviews',
          effectiveDirective: 'connect-src',
          blockedURL: 'https://tracker.example/beacon',
        },
      },
    ]);
    const res = await post('application/reports+json', body, '10.7.0.3');
    expect(res.statusCode).toBe(204);
  });

  it('body 9 KB → 413 từ trần parser, không tới controller', async () => {
    const big = JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(9 * 1024) } });
    const res = await post('application/csp-report', big, '10.7.0.4');
    expect(res.statusCode).toBe(413);
  });

  it('application/json (lách trần 8 KB qua parser toàn cục) → 415 — path này chỉ nhận hai MIME CSP', async () => {
    const res = await post('application/json', JSON.stringify({ 'csp-report': {} }), '10.7.0.6');
    expect(res.statusCode).toBe(415);
  });

  it('report có documentUri host lạ → 204 nhưng KHÔNG log (report bịa không chiếm chỗ dedupe)', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    try {
      const res = await post(
        'application/csp-report',
        JSON.stringify({
          'csp-report': {
            'document-uri': 'https://evil.example/anything',
            'violated-directive': 'script-src',
            'blocked-uri': 'https://x.example/y.js',
          },
        }),
        '10.7.0.7',
      );
      expect(res.statusCode).toBe(204);
      expect(warn.mock.calls.filter((c) => String(c[0]).startsWith('csp-report '))).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });

  it('documentUri có ?token= → dòng log KHÔNG chứa token', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    try {
      await post(
        'application/csp-report',
        JSON.stringify({
          'csp-report': {
            'document-uri': 'http://localhost:3000/reset-password?token=SECRET-TOKEN',
            'violated-directive': 'style-src',
            'blocked-uri': 'https://fonts.example/a.css',
          },
        }),
        '10.7.0.8',
      );
      const logged = warn.mock.calls
        .map((c) => String(c[0]))
        .filter((l) => l.startsWith('csp-report '));
      expect(logged.some((l) => l.includes('SECRET-TOKEN'))).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('body không phải JSON → vẫn 204 im lặng (non-2xx chỉ mời browser retry)', async () => {
    const res = await post('application/csp-report', 'not-json{{{', '10.7.0.5');
    expect(res.statusCode).toBe(204);
  });
});
