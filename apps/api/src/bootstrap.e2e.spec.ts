import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module.js';
import { configureHttp } from './bootstrap.js';

/**
 * CORS là bề mặt bảo mật: thiếu nó thì web/admin bị trình duyệt chặn sạch;
 * mở quá tay (`origin: true`) thì trang bất kỳ đọc được API kèm cookie phiên
 * của người dùng. Cả hai chiều đều phải có test canh.
 */
describe('configureHttp + AppModule infra (e2e — CORS · helmet · exception filter)', () => {
  let app: NestFastifyApplication;
  // Khớp default của TRUSTED_ORIGINS trong config/env.ts.
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureHttp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cho phép origin nằm trong TRUSTED_ORIGINS, kèm credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: allowedOrigin },
    });
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    // Thiếu header này thì trình duyệt không gửi cookie phiên Better Auth.
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('KHÔNG cấp quyền cho origin lạ', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example.com' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('trả lời preflight OPTIONS cho origin hợp lệ', async () => {
    // Mọi request có Content-Type: application/json từ trình duyệt đều bắn
    // preflight trước — trượt bước này là toàn bộ POST của web hỏng.
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/tours',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
  });

  /**
   * Đo sống (Task 7/A2, `DangerZone` gọi `DELETE /api/account` từ browser):
   * `@fastify/cors` 11.x mặc định `methods: 'GET,HEAD,POST'` (đối chiếu
   * `node_modules/@fastify/cors/index.js` — KHÔNG đoán) — thiếu tường minh
   * `DELETE` thì preflight của route DUY NHẤT dùng verb này
   * (`AccountController.deleteOwnAccount`) bị trình duyệt chặn NGAY tại
   * preflight, endpoint không bao giờ được gọi tới dù server hoàn toàn khoẻ.
   * Bài học 19/07 kiểu cũ: hạ tầng xuyên suốt (CORS) nằm ngoài mọi test
   * per-endpoint nên lặng lẽ hỏng cho tới khi đo sống bằng trình duyệt thật.
   */
  it('cho phép preflight DELETE (AccountController.deleteOwnAccount — verb DUY NHẤT ngoài GET/POST)', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/account',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'DELETE',
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
  });

  // ── Helmet (ADR-0010) ────────────────────────────────────────────────────
  it('gắn security header cơ bản (helmet) trên response', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    // helmet đặt X-Content-Type-Options: nosniff cho mọi response.
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // CSP CỐ Ý tắt cho API (ADR-0010 — CSP là việc web P3b).
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  // ── Exception filter — envelope oRPC (ADR-0010) ──────────────────────────
  it('lỗi từ guard (401) → envelope thống nhất có `code`', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/account/me' }); // không cookie
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      defined: false,
      code: 'UNAUTHORIZED',
      status: 401,
      data: null,
    });
    expect(typeof res.json().message).toBe('string');
    // (Bằng chứng filter KHÔNG đụng procedure-error oRPC — `/tours/:slug` lạ vẫn
    // `{code:'NOT_FOUND'}` — nằm ở catalog.int.spec, spec đó có DB.)
  });
});
