import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { createFastifyAdapter } from '../../bootstrap.js';
import { EmailType } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Đăng ký nhận bản tin P3a-B Task 5: endpoint GHI công khai thứ hai khách
 * CHƯA đăng nhập gọi được — @Public(), honeypot KHÔNG reject, throttle
 * 5/60s theo IP (cùng khuôn với enquiries Task 4). Điểm khác biệt cốt lõi:
 * response LUÔN `{subscribed: true}` bất kể mới/đã có/honeypot — chống dò
 * email — và welcome email chỉ gửi MỘT LẦN VĨNH VIỄN cho mỗi địa chỉ nhờ
 * `dedupeKey` ổn định `newsletter-welcome:<email>` + `skipDuplicates`.
 *
 * Dùng createFastifyAdapter() dùng chung với main.ts (trustProxy) — thiếu nó
 * thì test throttle theo IP sai (mọi request `.inject()` trông như cùng một
 * IP giả của socket).
 */

let app: NestFastifyApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE subscribers, outbox RESTART IDENTITY CASCADE');
});

/** Gửi POST /api/newsletter/subscribe, giả lập một IP riêng cho mỗi test
 * (tránh đụng chung bucket ThrottlerGuard in-memory giữa các test không liên
 * quan — bộ đếm sống xuyên suốt tiến trình test). */
function postSubscribe(
  app: NestFastifyApplication,
  payload: Record<string, unknown>,
  fakeIp: string,
) {
  return app.inject({
    method: 'POST',
    url: '/api/newsletter/subscribe',
    headers: { 'x-forwarded-for': fakeIp },
    payload,
  });
}

describe('newsletter (int)', () => {
  it('đăng ký mới → 200 {subscribed:true}, DB có 1 row, outbox có NEWSLETTER_WELCOME đúng dedupeKey', async () => {
    const email = 'new.subscriber@example.com';
    const res = await postSubscribe(app, { email }, '10.1.0.1');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ subscribed: true });

    const subscriber = await prisma.subscriber.findUniqueOrThrow({ where: { email } });
    expect(subscriber.email).toBe(email);

    const outboxRows = await prisma.outbox.findMany({
      where: { type: EmailType.NEWSLETTER_WELCOME },
    });
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]?.dedupeKey).toBe(`newsletter-welcome:${email}`);
  });

  it('đăng ký lại cùng email → response GIỐNG HỆT, DB vẫn 1 row (source KHÔNG bị ghi đè), outbox vẫn 1 welcome (không gửi lần hai)', async () => {
    const email = 'repeat.subscriber@example.com';
    const first = await postSubscribe(app, { email, source: 'homepage-footer' }, '10.1.0.2');
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ subscribed: true });

    // `source` KHÁC ở lần gọi thứ hai — mutation-test đã phát hiện: đổi
    // `update: {}` (upsert) thành `update: { source: ... }` để 5 test cũ
    // (không kiểm `source` sau lần đăng ký lại) vẫn XANH hết. Assertion
    // dưới đây soi ĐÚNG field bị ghi đè để bắt lớp lỗi đó.
    const second = await postSubscribe(app, { email, source: 'blog-post-cta' }, '10.1.0.2');
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ subscribed: true });

    expect(await prisma.subscriber.count()).toBe(1);
    const subscriber = await prisma.subscriber.findUniqueOrThrow({ where: { email } });
    expect(subscriber.source).toBe('homepage-footer');

    const outboxRows = await prisma.outbox.findMany({
      where: { type: EmailType.NEWSLETTER_WELCOME },
    });
    expect(outboxRows).toHaveLength(1);
  });

  it('email khác hoa/thường (Jane@X.com vs jane@x.com) → citext coi là MỘT người, vẫn 1 row, VÀ chỉ 1 welcome', async () => {
    const first = await postSubscribe(app, { email: 'Jane@X.com' }, '10.1.0.3');
    expect(first.statusCode).toBe(200);

    const second = await postSubscribe(app, { email: 'jane@x.com' }, '10.1.0.3');
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ subscribed: true });

    expect(await prisma.subscriber.count()).toBe(1);
    const found = await prisma.subscriber.findFirst({ where: { email: 'jane@x.com' } });
    expect(found).not.toBeNull();

    // Oracle bắt lỗi thật: `Subscriber.email` là citext nên DB tự coi hai
    // biến thể hoa/thường là MỘT hàng — assertion phía trên vẫn xanh dù
    // service có chuẩn hoá email hay không. Nhưng `Outbox.dedupeKey` là
    // VarChar thường; nếu service ghép dedupeKey từ email thô (chưa
    // `.toLowerCase()`), hai lần subscribe ở trên sinh hai dedupeKey khác
    // chuỗi và `skipDuplicates` không chặn được — ra 2 row welcome cho cùng
    // một hộp thư (vi phạm spec §4.4). `beforeEach` đã TRUNCATE nên đếm
    // tuyệt đối là đủ, không cần lọc theo dedupeKey.
    expect(await prisma.outbox.count({ where: { type: EmailType.NEWSLETTER_WELCOME } })).toBe(1);
  });

  it('honeypot có giá trị → 200 {subscribed:true} GIẢ, DB không có row mới', async () => {
    const before = await prisma.subscriber.count();

    const res = await postSubscribe(
      app,
      { email: 'honeypot.victim@example.com', website: 'http://spam.example' },
      '10.1.0.4',
    );

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ subscribed: true });
    expect(await prisma.subscriber.count()).toBe(before);
    expect(await prisma.outbox.count()).toBe(0);
  });

  it('throttle: gửi 6 lần liên tiếp cùng IP → lần thứ 6 trả 429', async () => {
    const ip = '10.1.0.5';
    for (let i = 1; i <= 5; i++) {
      const res = await postSubscribe(app, { email: `throttle-${i}@example.com` }, ip);
      expect(res.statusCode, `request thứ ${i} phải qua`).toBe(200);
    }
    const sixth = await postSubscribe(app, { email: 'throttle-6@example.com' }, ip);
    expect(sixth.statusCode).toBe(429);
    expect(await prisma.subscriber.count()).toBe(5);
  });
});
