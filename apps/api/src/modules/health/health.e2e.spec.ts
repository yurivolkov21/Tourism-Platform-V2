import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';

describe('GET /health (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('thật sự chạm DB, không phải trả ok tĩnh', async () => {
    // Bảo vệ chính: nếu ai đó bỏ `SELECT 1` đi, test này vẫn xanh nhưng
    // test bên dưới (DB chết → 503) sẽ đỏ. Cặp hai test mới đủ nghĩa.
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json()).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('trả 503 + database:down khi query DB ném lỗi', async () => {
    // Vì sao quan trọng: Supabase free TỰ PAUSE sau 7 ngày không hoạt động.
    // Probe trả ok tĩnh sẽ báo xanh trong khi mọi request thật đều 5xx —
    // nền tảng không restart, không ai được cảnh báo.
    const { prisma } = await import('../../auth/auth.config.js');
    const spy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection lost'));

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', database: 'down' });
    // Không được rò chi tiết lỗi DB ra endpoint public.
    expect(res.payload).not.toContain('connection lost');
    spy.mockRestore();
  });
});
