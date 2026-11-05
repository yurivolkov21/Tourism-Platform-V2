import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { configureHttp, createFastifyAdapter } from '../../bootstrap.js';

/**
 * Trang gốc `GET /` của API: trước đây 404, ai mở `api.nexora-travel.agency`
 * trên trình duyệt (hội đồng, người chấm) tưởng API chết. Dựng app bằng
 * adapter + `configureHttp` của production để CORS, helmet, cổng 415 và tầng
 * throttle cùng chạm route này như trên Render.
 */
describe('GET / (e2e — trang gốc của API)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
    await configureHttp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('trả 200 với JSON gọn: tên dịch vụ, trạng thái, link tới probe', async () => {
    // Không cookie, không header: đúng như trình duyệt của người lạ. Thiếu
    // `@Public()` thì AuthGuard fail-closed trả 401 ở đây.
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.json()).toEqual({
      service: 'nexora-api',
      status: 'ok',
      links: { health: '/health', liveness: '/api/health' },
    });
  });

  it('không chạm DB: DB chết thì trang gốc vẫn 200, còn /health vẫn báo 503', async () => {
    // Trang gốc chỉ nói "tiến trình đang chạy". Readiness là việc của /health;
    // để trang gốc query DB là nhân đôi probe và thêm một đường đốt pool.
    const { prisma } = await import('../../auth/auth.config.js');
    const spy = vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('connection lost'));
    try {
      const root = await app.inject({ method: 'GET', url: '/' });
      expect(root.statusCode).toBe(200);
      expect(spy).not.toHaveBeenCalled();

      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(503);
    } finally {
      spy.mockRestore();
    }
  });

  it('HEAD / cũng 200 (Fastify tự sinh route HEAD cho GET)', async () => {
    // Uptime monitor hay dùng HEAD; 404 ở HEAD là cùng lỗi cũ dưới dạng khác.
    const res = await app.inject({ method: 'HEAD', url: '/' });
    expect(res.statusCode).toBe(200);
  });

  it('mang security header của helmet như mọi route khác', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('chỉ đúng "/" được mở: path lạ vẫn 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/khong-co-route-nay' });
    expect(res.statusCode).toBe(404);
  });
});
