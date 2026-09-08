import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module.js';
import { configureHttp, createFastifyAdapter } from './bootstrap.js';

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
    // Adapter CHUNG với main.ts (vòng vá review W2) — bản đầu tự dựng
    // `new FastifyAdapter()` nên trustProxy/timeout của prod không được e2e chạm.
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
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

  it('preflight OPTIONS /api/webhooks/csp-report cho CẢ web lẫn admin origin (vòng vá review W4)', async () => {
    // Browser gửi report-to/report-uri bằng POST cross-origin với MIME riêng
    // (`application/csp-report`, `application/reports+json`) — trình duyệt
    // preflight (Chromium gửi OPTIONS cho report-uri cross-origin). Admin
    // origin nằm trong TRUSTED_ORIGINS mặc định (localhost:3002) nhưng vùng
    // /api/admin thì `origin: false` — endpoint CSP KHÔNG ở vùng đó.
    for (const origin of ['http://localhost:3000', 'http://localhost:3002']) {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/webhooks/csp-report',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });
      expect(res.statusCode, origin).toBeLessThan(300);
      expect(res.headers['access-control-allow-origin'], origin).toBe(origin);
    }
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

  /**
   * Đo sống lần hai, CÙNG lớp lỗi với case DELETE ở trên (12/08 — user báo
   * upload avatar chạy tới 100% rồi báo "Upload failed"): cụm ADR-0021 thêm
   * `account.setAvatar` = `PATCH /api/account/avatar`, verb PATCH ĐẦU TIÊN của
   * contract, nhưng allowlist `methods` không được cập nhật kèm. Ảnh lên
   * Cloudinary xong xuôi, chỉ bước ghi `User.image` bị trình duyệt chặn ngay
   * tại preflight — server không hề thấy request, mọi int/e2e test khác vẫn
   * xanh vì `app.inject()` KHÔNG enforce CORS. Case này là thứ duy nhất bắt
   * được lớp lỗi đó mà không cần mở trình duyệt thật.
   */
  it('cho phép preflight PATCH (account.setAvatar — verb PATCH DUY NHẤT của contract)', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/account/avatar',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
  });

  /**
   * W2 (ADR-0026 AMEND 1 §B): /api/admin/* KHÔNG phát CORS cho BẤT KỲ origin
   * nào — admin app gọi API hoàn toàn từ phía server (cookie forward), nên
   * không tồn tại client browser hợp lệ nào cần CORS ở vùng này; giữ nó mở
   * là để một XSS ở www (cookie cha) gọi trọn 25 endpoint admin bằng cookie
   * của nạn nhân. Đây là nhát cắt tầng CORS; CSP ở web là việc W3.
   */
  it('KHÔNG phát CORS cho /api/admin/* — kể cả với origin nằm trong danh sách', async () => {
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/admin/bookings',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'GET',
      },
    });
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    const read = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings',
      headers: { origin: allowedOrigin },
    });
    expect(read.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('/api/admin?x (có query) cũng KHÔNG phát CORS — so path đã bỏ query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin?x=1',
      headers: { origin: allowedOrigin },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  /**
   * ADR-0026 AMEND 2: CORS chỉ giấu response. Form-urlencoded là simple request
   * không preflight và từng THI HÀNH tới handler (parser toàn cục của
   * rawBody). Nay 415 trước cả AuthGuard; JSON vẫn đi tới guard (401 vì không
   * cookie); Sec-Fetch-Site cross-site vào vùng admin là 403.
   */
  it('POST form-urlencoded vào route ghi (ngoài /api/auth, /api/webhooks) → 415 trước handler', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/bookings/BK-X/refund',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: allowedOrigin },
      payload: 'amount=1200&reason=x',
    });
    expect(res.statusCode).toBe(415);
    expect(res.json()).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    const json = await app.inject({
      method: 'POST',
      url: '/api/admin/bookings/BK-X/refund',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ amount: '1.00', reason: 'x' }),
    });
    expect(json.statusCode).toBe(401); // qua gate, tới AuthGuard
    const crossSite = await app.inject({
      method: 'POST',
      url: '/api/admin/bookings/BK-X/refund',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      payload: JSON.stringify({ amount: '1.00', reason: 'x' }),
    });
    expect(crossSite.statusCode).toBe(403);
    // /api/auth/* (Better Auth tự CSRF) và webhook (provider gửi JSON) không bị gate này chạm.
    const auth = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'email=a%40b.c&password=x',
    });
    expect(auth.statusCode).not.toBe(415);
  });

  it('đường KHÔNG-admin vẫn phát CORS bình thường sau khi tách (không vỡ web)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/account/me',
      headers: { origin: allowedOrigin },
    });
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
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
