import { Controller, Post, UseGuards } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../app.module.js';
import { Public } from '../auth/public.decorator.js';
import { createFastifyAdapter } from '../bootstrap.js';

/**
 * Canh chính cơ chế: không có test này thì ai đó gỡ ThrottlerModule mà cả
 * suite vẫn xanh — đúng loại lỗ mutation-test 19/07 đã vạch ra.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('test-throttled')
class ThrottledController {
  @Post()
  submit() {
    return { ok: true };
  }
}

describe('rate limiting endpoint ghi công khai', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ThrottledController],
    }).compile();
    // Adapter thật qua createFastifyAdapter() (trustProxy: 1) — PHẢI dùng vì test
    // dựng app trực tiếp qua Test.createTestingModule(), không đi qua main.ts.
    // Fastify mặc định KHÔNG đọc `x-forwarded-for`; thiếu cờ này thì `req.ip`
    // luôn là địa chỉ socket giả của `.inject()` (giống hệt cho mọi request),
    // khiến ThrottlerGuard đếm chung một khoá bất kể header IP test set khác nhau
    // (test "đếm theo IP" sẽ bị vạ lây 429 dù dùng client khác). `1` (không phải
    // `true`) là điều then chốt cho test chống-spoof bên dưới.
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cho qua 5 request đầu rồi chặn request thứ 6 bằng 429', async () => {
    const call = () =>
      app.inject({
        method: 'POST',
        url: '/test-throttled',
        payload: {},
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });

    for (let i = 1; i <= 5; i++) {
      const res = await call();
      expect(res.statusCode, `request thứ ${i} phải qua`).toBe(201);
    }
    const blocked = await call();
    expect(blocked.statusCode).toBe(429);
  });

  it('đếm theo IP — client khác không bị vạ lây', async () => {
    // Nếu trần bị đếm toàn cục thay vì theo IP thì test này đỏ, và đó chính
    // là kịch bản "một bot khoá sạch cả site".
    const res = await app.inject({
      method: 'POST',
      url: '/test-throttled',
      payload: {},
      headers: { 'x-forwarded-for': '198.51.100.20' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('không bypass được throttle bằng cách giả mạo `X-Forwarded-For` (ENQ-R1)', async () => {
    // Kẻ tấn công đổi entry TRÁI NHẤT của XFF mỗi request để né rate-limit theo IP.
    // Với `trustProxy: 1`, `req.ip` chỉ tin ĐÚNG một hop → lấy entry phải nhất
    // (IP client thật mà proxy nền tảng thấy), nên mọi request vẫn đếm chung một
    // khoá → request thứ 6 bị 429. Với lỗ cũ `trustProxy: true`, Fastify tin cả
    // chuỗi → `req.ip` = entry trái nhất tự đặt → mỗi request một khoá → KHÔNG
    // BAO GIỜ chặn (test này ĐỎ). IP thật (.99) khác hai IP ở test trên → khoá sạch.
    const spoof = (leftmost: number) =>
      app.inject({
        method: 'POST',
        url: '/test-throttled',
        payload: {},
        headers: { 'x-forwarded-for': `10.0.0.${leftmost}, 203.0.113.99` },
      });

    for (let i = 1; i <= 5; i++) {
      const res = await spoof(i);
      expect(res.statusCode, `request giả mạo thứ ${i} (XFF trái nhất khác nhau) phải qua`).toBe(
        201,
      );
    }
    const blocked = await spoof(6);
    expect(blocked.statusCode, 'request thứ 6 phải bị 429 dù XFF trái nhất luôn đổi').toBe(429);
  });
});
