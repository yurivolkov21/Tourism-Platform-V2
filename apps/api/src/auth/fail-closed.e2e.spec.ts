import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { Public } from './public.decorator.js';

/**
 * Canh chính CÁI MẶC ĐỊNH của ADR-0003.
 *
 * Không có test này thì ADR chỉ là lời hứa: ai đó gỡ `APP_GUARD` khỏi
 * `app.module.ts` và cả suite vẫn xanh — đúng kiểu lỗ mà mutation-test
 * 19/07 đã vạch ra (xoá `@Roles(ADMIN)` mà 72/72 test vẫn qua).
 *
 * Hai controller dưới đây được đăng ký NGAY TRONG test, mô phỏng đúng thứ
 * sẽ xảy ra ở P4/P5/P6: lập trình viên thêm controller mới. Cái không khai
 * gì phải bị chặn; cái khai `@Public()` phải qua.
 */

@Controller('test-forgot-to-declare-auth')
class ForgotAuthController {
  @Get()
  secret() {
    return { leaked: 'dữ liệu nhạy cảm' };
  }
}

@Controller('test-explicitly-public')
class ExplicitlyPublicController {
  @Public()
  @Get()
  open() {
    return { ok: true };
  }
}

describe('ADR-0003 — auth mặc định fail-closed', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ForgotAuthController, ExplicitlyPublicController],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('controller MỚI không khai gì → bị chặn 401, không rò dữ liệu', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-forgot-to-declare-auth' });
    expect(res.statusCode).toBe(401);
    expect(res.payload).not.toContain('nhạy cảm');
  });

  it('controller khai @Public() → qua được', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-explicitly-public' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('bề mặt public thật vẫn mở cho khách ẩn danh', async () => {
    // Bốn nhánh này mà 401 là hỏng nghiêm trọng: catalogue không xem được,
    // probe hạ tầng báo chết, webhook provider bị từ chối, và không ai
    // đăng nhập được nữa.
    for (const url of ['/health', '/api/tours', '/api/destinations', '/api/categories']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, `${url} phải public`).not.toBe(401);
    }
  });

  it('webhook provider KHÔNG bị 401 (chữ ký HMAC mới là lớp xác thực)', async () => {
    // 401 ở đây = Stripe/PayPal bị từ chối → retry rồi bỏ cuộc → booking
    // kẹt PENDING dù tiền đã trừ. Body rỗng nên sẽ hỏng ở tầng verify chữ
    // ký (400/4xx khác) — điều cần khẳng định là KHÔNG phải 401.
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      payload: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).not.toBe(401);
  });

  it('route cần auth vẫn 401 khi ẩn danh', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/bookings' });
    expect(res.statusCode).toBe(401);
  });
});
