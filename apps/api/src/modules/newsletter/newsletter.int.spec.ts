import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { createFastifyAdapter } from '../../bootstrap.js';
import { env } from '../../config/env.js';
import { EmailType, OutboxStatus } from '../../generated/prisma/enums.js';
import { EMAIL_DELIVERER, type EmailDeliverer } from '../../worker/deliverer.js';
import { OutboxService } from '../../worker/outbox.service.js';
import { WorkerModule } from '../../worker/worker.module.js';
import { CONFIRM_RESEND_AFTER_MS } from './newsletter.service.js';
import {
  consentGeneration,
  makeNewsletterToken,
  makeUnsubscribeToken,
} from './unsubscribe-token.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Đăng ký nhận bản tin P3a-B Task 5: endpoint GHI công khai thứ hai khách
 * CHƯA đăng nhập gọi được — @Public(), honeypot KHÔNG reject, throttle
 * 5/60s theo IP (cùng khuôn với enquiries Task 4). Điểm khác biệt cốt lõi:
 * response LUÔN `{subscribed: true}` bất kể mới/đã có/honeypot — chống dò
 * email — và welcome email chỉ gửi MỘT LẦN VĨNH VIỄN cho mỗi địa chỉ nhờ
 * `dedupeKey` ổn định `newsletter-welcome:<email>` + `skipDuplicates`.
 *
 * Task 6 (P3a-B, endpoint MỚI — A1): tự huỷ đăng ký, thứ Nexora KHÔNG có
 * (rủi ro pháp lý GDPR/CAN-SPAM). Token HMAC tự xác thực (unsubscribe-token.ts,
 * TDD riêng ở unsubscribe-token.spec.ts) — GET chỉ đọc (trang xác nhận),
 * POST mới thực thi, tách hẳn vì email client (Gmail/Outlook) prefetch mọi
 * link trong thư để quét virus.
 *
 * Dùng createFastifyAdapter() dùng chung với main.ts (trustProxy) — thiếu nó
 * thì test throttle theo IP sai (mọi request `.inject()` trông như cùng một
 * IP giả của socket).
 */

let app: NestFastifyApplication;

/** Fake deliverer riêng cho test "worker bỏ qua subscriber đã huỷ" — cùng
 * pattern với outbox.int.spec.ts (test worker thật, không mock Prisma). */
class FakeDeliverer implements EmailDeliverer {
  calls: Array<{ type: EmailType; payload: unknown }> = [];

  async deliver(type: EmailType, payload: unknown): Promise<void> {
    this.calls.push({ type, payload });
  }

  reset(): void {
    this.calls = [];
  }
}

const fakeDeliverer = new FakeDeliverer();
let outbox: OutboxService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  // Module RIÊNG cho worker (AppModule không import WorkerModule — chạy ở
  // tiến trình process.ts khác trong sản phẩm thật) — chỉ để test hành vi
  // drain bỏ qua subscriber đã huỷ (item 5 spec §4.4 / §6).
  const workerModuleRef = await Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(EMAIL_DELIVERER)
    .useValue(fakeDeliverer)
    .compile();
  outbox = workerModuleRef.get(OutboxService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE subscribers, outbox RESTART IDENTITY CASCADE');
  fakeDeliverer.reset();
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
    // remoteAddress THẬT (W2/ADR-0037): guard toàn cục miễn loopback ngoài
    // production và đo bằng địa chỉ socket — XFF không có tiếng nói ở đây.
    remoteAddress: fakeIp,
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

  it('ghi outbox lỗi giữa transaction → subscriber KHÔNG được lưu, không ai kẹt vĩnh viễn không có welcome', async () => {
    // `subscribe()` ghi HAI thứ: hàng `subscriber` và hàng `outbox`
    // NEWSLETTER_WELCOME. Trước fix chúng là hai round-trip ĐỘC LẬP, nên một
    // cú crash/lỗi ở giữa để lại subscriber KHÔNG BAO GIỜ nhận welcome — và
    // vì `dedupeKey` khoá theo email "một lần vĩnh viễn", lần đăng ký lại
    // cũng không sinh được welcome mới. Chỉ tự khỏi nếu ĐÚNG người đó tình cờ
    // điền lại form, mà cái đó cũng vô ích vì upsert `update: {}` no-op.
    //
    // Cùng khuôn với test atomicity của enquiry: cài TẠM một CHECK constraint
    // chặn insert NEWSLETTER_WELCOME để ép lệnh ghi THỨ HAI hỏng giữa chừng,
    // rồi khẳng định hàng `subscriber` ghi TRƯỚC đó cũng rollback theo.
    await prisma.$executeRawUnsafe(`
      ALTER TABLE outbox ADD CONSTRAINT newsletter_int_spec_block_welcome
      CHECK (type <> 'NEWSLETTER_WELCOME')
    `);
    try {
      const email = 'atomicity.rollback@example.com';
      const res = await postSubscribe(app, { email }, '10.1.0.8');

      // Lỗi không lường trước → oRPC trả shape INTERNAL_SERVER_ERROR.
      expect(res.statusCode).toBeGreaterThanOrEqual(500);

      // Điều CỐT LÕI: subscriber KHÔNG tồn tại — transaction rollback sạch,
      // không dừng giữa chừng với subscriber đã lưu mà welcome thì không có.
      expect(await prisma.subscriber.findFirst({ where: { email } })).toBeNull();
      expect(await prisma.outbox.count()).toBe(0);
    } finally {
      // Dọn constraint TẠM — TRUNCATE ở beforeEach không xoá được nó.
      await prisma.$executeRawUnsafe(
        'ALTER TABLE outbox DROP CONSTRAINT newsletter_int_spec_block_welcome',
      );
    }
  });

  it('honeypot `website` quá dài → CẮT NGẮN, response vẫn KHÔNG phân biệt được với thành công (không 400)', async () => {
    // Cùng lý do như bên enquiry: chuỗi do kẻ tấn công điều khiển, không trần
    // thì bot bơm được ~1 MB text tự chọn (kể cả CR/LF giả mạo dòng log) vào
    // log ứng dụng. CẮT chứ không reject — Fastify parse xong body trước khi
    // zod chạy nên reject không tiết kiệm gì, chỉ trả lại cho bot tín hiệu
    // phân biệt 400-vs-200 mà honeypot sinh ra để xoá.
    //
    // IP RIÊNG: ThrottlerGuard in-memory đếm theo IP xuyên suốt cả file spec
    // — dùng lại IP của test khác là ăn mất một lượt trong hạn mức của nó.
    const res = await postSubscribe(
      app,
      { email: 'honeypot.oversize@example.com', website: 'a'.repeat(5000) },
      '10.1.0.6',
    );

    // Byte-identical với nhánh thành công.
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ subscribed: true });

    expect(await prisma.subscriber.count()).toBe(0);
    expect(await prisma.outbox.count()).toBe(0);
  });

  it('W4 E2 (ADR-0039): subscribe → drain → purge outbox → subscribe lại → KHÔNG welcome mới (welcomeSentAt là bằng chứng, không phải row outbox)', async () => {
    // Lỗ trước W4: "một lần vĩnh viễn" dựa hoàn toàn vào dedupeKey @unique,
    // nhưng row SENT bị purge sau 30 ngày — sau đó subscribe lại là welcome
    // lặp. Bằng chứng "đã gửi" phải sống ở subscriber, set trong CÙNG tx.
    const email = 'welcome.once.forever@example.com';
    const first = await postSubscribe(app, { email }, '10.1.0.10');
    expect(first.statusCode).toBe(200);

    const afterFirst = await prisma.subscriber.findUniqueOrThrow({ where: { email } });
    expect(afterFirst.welcomeSentAt).toBeInstanceOf(Date);

    // Mô phỏng trọn vòng đời: gửi thật (drain) rồi purge hết row đã xử lý.
    await outbox.drainOnce();
    await outbox.purgeSent(0);
    expect(await prisma.outbox.count()).toBe(0);

    const second = await postSubscribe(app, { email }, '10.1.0.11');
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ subscribed: true });

    // Điểm mấu chốt: KHÔNG row welcome mới dù dedupeKey cũ đã bị purge.
    expect(await prisma.outbox.count({ where: { type: EmailType.NEWSLETTER_WELCOME } })).toBe(0);
    // Mốc lần đầu giữ nguyên — subscribe lại không "làm mới" bằng chứng.
    const afterSecond = await prisma.subscriber.findUniqueOrThrow({ where: { email } });
    expect(afterSecond.welcomeSentAt).toEqual(afterFirst.welcomeSentAt);
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

/** Đăng ký một subscriber thật qua endpoint công khai rồi đọc lại row (cần
 * `id` để sinh token) — dựng dữ liệu qua API thay vì `prisma.subscriber.create`
 * thẳng để test không phụ thuộc chi tiết nội bộ của bảng. */
async function createSubscriber(email: string, ip: string) {
  const res = await postSubscribe(app, { email }, ip);
  expect(res.statusCode).toBe(200);
  return prisma.subscriber.findUniqueOrThrow({ where: { email } });
}

describe('newsletter unsubscribe (int)', () => {
  it('GET với token hợp lệ → trả email + alreadyUnsubscribed:false, DB KHÔNG đổi (GET không có side effect)', async () => {
    const email = 'confirm.valid@example.com';
    const subscriber = await createSubscriber(email, '10.1.1.1');
    const token = makeUnsubscribeToken(subscriber.id, env.NEWSLETTER_UNSUBSCRIBE_SECRET);

    const res = await app.inject({
      method: 'GET',
      url: `/api/newsletter/unsubscribe?id=${subscriber.id}&token=${token}`,
      headers: { 'x-forwarded-for': '10.1.1.1' },
    });

    expect(res.statusCode).toBe(200);
    // Vòng vá review W4: GET KHÔNG phát resubscribeToken — token đó chỉ đi ra
    // từ POST huỷ vừa thành công.
    expect(res.json()).toEqual({ email, alreadyUnsubscribed: false });

    // Oracle bắt lỗi thật: nếu GET vô tình cũng set unsubscribedAt (side
    // effect KHÔNG được phép — email client prefetch link này để quét virus,
    // xem doc-comment đầu file), assertion dưới đây sẽ đỏ.
    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.unsubscribedAt).toBeNull();
  });

  it('POST với token hợp lệ → unsubscribedAt được set', async () => {
    const email = 'unsub.first@example.com';
    const subscriber = await createSubscriber(email, '10.1.1.2');
    const token = makeUnsubscribeToken(subscriber.id, env.NEWSLETTER_UNSUBSCRIBE_SECRET);

    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': '10.1.1.2' },
      payload: { id: subscriber.id, token },
    });

    expect(res.statusCode).toBe(200);
    // Vòng vá review W4: lượt VỪA claim được mang token đổi ý (30 ngày).
    expect(res.json()).toEqual({
      unsubscribed: true,
      resubscribeToken: expect.stringMatching(/^v1\.resubscribe\./),
    });

    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.unsubscribedAt).toBeInstanceOf(Date);
  });

  it('POST lần hai → vẫn 200 (idempotent), unsubscribedAt KHÔNG đổi giá trị', async () => {
    const email = 'unsub.twice@example.com';
    const subscriber = await createSubscriber(email, '10.1.1.3');
    const token = makeUnsubscribeToken(subscriber.id, env.NEWSLETTER_UNSUBSCRIBE_SECRET);
    const payload = { id: subscriber.id, token };
    const ip = '10.1.1.3';

    const first = await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': ip },
      payload,
    });
    expect(first.statusCode).toBe(200);
    const firstUnsubscribedAt = (
      await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    ).unsubscribedAt;

    const second = await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': ip },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ unsubscribed: true });

    const afterSecond = await prisma.subscriber.findUniqueOrThrow({
      where: { id: subscriber.id },
    });
    // Mốc thời gian PHẢI giữ nguyên lần gọi đầu — POST thứ hai không được
    // "làm mới" ngày huỷ đăng ký (đó mới là bằng chứng consent chính xác).
    expect(afterSecond.unsubscribedAt).toEqual(firstUnsubscribedAt);
  });

  it('token sai / id không tồn tại → INVALID_UNSUBSCRIBE_TOKEN (400), DB không đổi — cả GET lẫn POST', async () => {
    const email = 'unsub.badtoken@example.com';
    const subscriber = await createSubscriber(email, '10.1.1.4');
    const wrongToken = makeUnsubscribeToken(subscriber.id, 'not-the-real-secret');
    const randomId = '01920000-0000-7000-8000-00000000dead';
    const validTokenForRandomId = makeUnsubscribeToken(randomId, env.NEWSLETTER_UNSUBSCRIBE_SECRET);

    const wrongTokenRes = await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': '10.1.1.4' },
      payload: { id: subscriber.id, token: wrongToken },
    });
    expect(wrongTokenRes.statusCode).toBe(400);
    expect(wrongTokenRes.json().code).toBe('INVALID_UNSUBSCRIBE_TOKEN');

    const missingIdRes = await app.inject({
      method: 'GET',
      url: `/api/newsletter/unsubscribe?id=${randomId}&token=${validTokenForRandomId}`,
      headers: { 'x-forwarded-for': '10.1.1.4' },
    });
    expect(missingIdRes.statusCode).toBe(400);
    expect(missingIdRes.json().code).toBe('INVALID_UNSUBSCRIBE_TOKEN');

    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.unsubscribedAt).toBeNull();
  });

  it('guard chỉ chặn BẢN TIN: email giao dịch tới người đã huỷ bản tin VẪN được gửi', async () => {
    // Mutation-test bắt lỗ hổng này: NỚI guard ra MỌI EmailType (bỏ điều kiện
    // `NEWSLETTER_EMAIL_TYPES.has(row.type)`) KHÔNG làm test nào đỏ — trong
    // khi đó là lỗi nghiêm trọng: khách huỷ BẢN TIN sẽ mất luôn email xác nhận
    // đơn hàng / hoàn tiền của chính họ (thứ họ đã trả tiền và luật KHÔNG cho
    // phép chặn). Test này ghim PHẠM VI của guard, không chỉ tác dụng của nó.
    const email = 'txn.still.sent@example.com';
    const subscriber = await createSubscriber(email, '10.1.1.6');
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { unsubscribedAt: new Date() },
    });
    await prisma.outbox.deleteMany();

    await outbox.enqueue(
      EmailType.BOOKING_CONFIRMATION,
      { email, code: 'BK-TXN-1' },
      `booking-confirmation:${email}`,
    );
    await outbox.enqueue(EmailType.NEWSLETTER_WELCOME, { email }, `newsletter-welcome:${email}`);

    const result = await outbox.drainOnce();

    // Bản tin bị bỏ qua; email giao dịch thì KHÔNG.
    expect(result.skippedUnsubscribed).toBe(1);
    expect(result.sent).toBe(1);
    expect(fakeDeliverer.calls).toHaveLength(1);
    expect(fakeDeliverer.calls[0]?.type).toBe(EmailType.BOOKING_CONFIRMATION);
  });

  it('worker bỏ qua subscriber đã huỷ: enqueue NEWSLETTER_WELCOME cho subscriber có unsubscribedAt ≠ null → không gửi', async () => {
    const email = 'already.unsubscribed@example.com';
    const subscriber = await createSubscriber(email, '10.1.1.5');
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { unsubscribedAt: new Date() },
    });
    // Outbox đã có 1 row NEWSLETTER_WELCOME từ createSubscriber() (subscribe
    // enqueue welcome) — xoá sạch rồi enqueue lại một row MỚI cho rõ ràng,
    // tránh lẫn với dedupeKey đã dùng ở bước subscribe. `outbox` ở đây là
    // OutboxService của module worker RIÊNG (deliverer = fakeDeliverer, xem
    // beforeAll) — dùng cùng instance cho cả enqueue lẫn drain.
    await prisma.outbox.deleteMany();
    const enqueued = await outbox.enqueue(
      EmailType.NEWSLETTER_WELCOME,
      { email },
      `newsletter-welcome:${email}`,
    );
    expect(enqueued).toBe(true);

    const result = await outbox.drainOnce();

    expect(result.skippedUnsubscribed).toBe(1);
    expect(result.sent).toBe(0);
    // Bằng chứng trực tiếp: deliverer KHÔNG hề được gọi cho email này.
    expect(fakeDeliverer.calls).toHaveLength(0);

    const row = await prisma.outbox.findFirstOrThrow({
      where: { dedupeKey: `newsletter-welcome:${email}` },
    });
    // SKIPPED, không phải SENT (vòng vá review F7): email chưa từng tới
    // Resend thì không được đếm là "đã giao" ở card admin.
    expect(row.status).toBe(OutboxStatus.SKIPPED);
    expect(row.processedAt).toBeInstanceOf(Date);
  });
});

// W4 E4 (ADR-0039 §3): token có MỤC ĐÍCH — một chuỗi không mở được mọi cửa.
describe('newsletter token purpose (int)', () => {
  it('token unsubscribe (v0 lẫn v1) KHÔNG resubscribe được — 400; resubscribeToken chỉ từ POST huỷ vừa thành công, POST lặp lại không phát', async () => {
    const email = 'purpose.bound@example.com';
    const subscriber = await createSubscriber(email, '10.1.3.1');
    const v0 = makeUnsubscribeToken(subscriber.id, env.NEWSLETTER_UNSUBSCRIBE_SECRET);

    // Huỷ bằng token v0 (email cũ) — vẫn phải chạy (tương thích lùi), và
    // lượt claim này phát resubscribeToken v1 có hạn 30 ngày.
    const unsub = await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': '10.1.3.1' },
      payload: { id: subscriber.id, token: v0 },
    });
    expect(unsub.statusCode).toBe(200);
    const resubscribeToken = unsub.json().resubscribeToken as string;
    expect(resubscribeToken).toMatch(/^v1\.resubscribe\./);

    // POST lặp lại (đã huỷ) → 200 nhưng KHÔNG phát lại token: người cầm link
    // huỷ cũ không mint được quyền đăng ký lại vô hạn.
    const again = await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': '10.1.3.1' },
      payload: { id: subscriber.id, token: v0 },
    });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ unsubscribed: true });

    // Cùng chuỗi v0 KHÔNG resubscribe được — trước W4 thì được (một token mở
    // mọi cửa), đó chính là lỗ E4 vá.
    const resubV0 = await app.inject({
      method: 'POST',
      url: '/api/newsletter/resubscribe',
      headers: { 'x-forwarded-for': '10.1.3.1' },
      payload: { id: subscriber.id, token: v0 },
    });
    expect(resubV0.statusCode).toBe(400);
    expect(resubV0.json().code).toBe('INVALID_UNSUBSCRIBE_TOKEN');

    // GET trang huỷ KHÔNG còn là nguồn token (vòng vá review W4).
    const confirm = await app.inject({
      method: 'GET',
      url: `/api/newsletter/unsubscribe?id=${subscriber.id}&token=${v0}`,
      headers: { 'x-forwarded-for': '10.1.3.1' },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json()).not.toHaveProperty('resubscribeToken');

    const resub = await app.inject({
      method: 'POST',
      url: '/api/newsletter/resubscribe',
      headers: { 'x-forwarded-for': '10.1.3.1' },
      payload: { id: subscriber.id, token: resubscribeToken },
    });
    expect(resub.statusCode).toBe(200);
    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.unsubscribedAt).toBeNull();
    // Đổi ý trong 30 ngày là consent của chủ hộp thư → mốc xác nhận được đặt
    // nếu đang null (người huỷ trước W4 bị migration bỏ confirmedAt).
    expect(after.confirmedAt).toBeInstanceOf(Date);
  });

  it('email mới enqueue mang unsubscribeToken v1 mục đích unsubscribe', async () => {
    const email = 'v1.in.payload@example.com';
    await createSubscriber(email, '10.1.3.2');
    const row = await prisma.outbox.findFirstOrThrow({
      where: { dedupeKey: `newsletter-welcome:${email}` },
    });
    const token = (row.payload as Record<string, unknown>).unsubscribeToken as string;
    expect(token).toMatch(/^v1\.unsubscribe\./);
  });
});

// W4 E3 (ADR-0039 §2): double opt-in — row chưa confirm là "đã xin", chưa
// phải "đã đồng ý"; thư đầu là thư XÁC NHẬN mang confirmToken.
/** Token confirm đúng THẾ HỆ consent của row (vòng vá review W4) — như thư thật mang. */
function confirmTokenFor(subscriber: { id: string; unsubscribedAt: Date | null }): string {
  return makeNewsletterToken(
    subscriber.id,
    'confirm',
    env.NEWSLETTER_UNSUBSCRIBE_SECRET,
    new Date(),
    consentGeneration(subscriber),
  );
}

describe('newsletter double opt-in (int)', () => {
  it('subscribe mới → confirmedAt null, thư đầu mang confirmToken v1 mục đích confirm', async () => {
    const email = 'optin.pending@example.com';
    const subscriber = await createSubscriber(email, '10.1.4.1');
    expect(subscriber.confirmedAt).toBeNull();

    const row = await prisma.outbox.findFirstOrThrow({
      where: { dedupeKey: `newsletter-welcome:${email}` },
    });
    const payload = row.payload as Record<string, unknown>;
    expect(payload.confirmToken as string).toMatch(/^v1\.confirm\./);
  });

  it('GET /api/newsletter/confirm token đúng → dữ liệu trang, KHÔNG side effect (mail client prefetch)', async () => {
    const email = 'optin.get@example.com';
    const subscriber = await createSubscriber(email, '10.1.4.2');
    const token = confirmTokenFor(subscriber);

    const res = await app.inject({
      method: 'GET',
      url: `/api/newsletter/confirm?id=${subscriber.id}&token=${token}`,
      headers: { 'x-forwarded-for': '10.1.4.2' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ email, alreadyConfirmed: false });

    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.confirmedAt).toBeNull();
  });

  it('POST confirm token đúng → confirmedAt set; POST lần hai idempotent, mốc KHÔNG đổi', async () => {
    const email = 'optin.claim@example.com';
    const subscriber = await createSubscriber(email, '10.1.4.3');
    const token = confirmTokenFor(subscriber);
    const payload = { id: subscriber.id, token };

    const first = await app.inject({
      method: 'POST',
      url: '/api/newsletter/confirm',
      headers: { 'x-forwarded-for': '10.1.4.3' },
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ confirmed: true });
    const afterFirst = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(afterFirst.confirmedAt).toBeInstanceOf(Date);

    const second = await app.inject({
      method: 'POST',
      url: '/api/newsletter/confirm',
      headers: { 'x-forwarded-for': '10.1.4.3' },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ confirmed: true });
    const afterSecond = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    // Mốc consent là bằng chứng — lần bấm thứ hai không được đè.
    expect(afterSecond.confirmedAt).toEqual(afterFirst.confirmedAt);
  });

  it('token sai mục đích (unsubscribe) hoặc sai chữ ký → 400 INVALID_CONFIRM_TOKEN, confirmedAt không đổi', async () => {
    const email = 'optin.badtoken@example.com';
    const subscriber = await createSubscriber(email, '10.1.4.4');
    const unsubToken = makeNewsletterToken(
      subscriber.id,
      'unsubscribe',
      env.NEWSLETTER_UNSUBSCRIBE_SECRET,
    );

    for (const token of [unsubToken, 'v1.confirm.deadbeef', '']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/newsletter/confirm',
        headers: { 'x-forwarded-for': '10.1.4.4' },
        payload: { id: subscriber.id, token },
      });
      // Chuỗi rỗng chết ở zod (min 1) cũng 400 — cùng mã ngoài là đủ.
      expect(res.statusCode).toBe(400);
    }
    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.confirmedAt).toBeNull();
  });

  it('vòng vá review W4: huỷ rồi → thư xác nhận CŨ chết (400); điền lại form → thư mới (thế hệ mới), confirm mở lại consent: unsubscribedAt null + confirmedAt set', async () => {
    const email = 'optin.regen@example.com';
    const ip = '10.1.4.5';
    const subscriber = await createSubscriber(email, ip);
    const oldConfirm = confirmTokenFor(subscriber);
    // Xác nhận lần đầu rồi huỷ.
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/newsletter/confirm',
          headers: { 'x-forwarded-for': ip },
          payload: { id: subscriber.id, token: oldConfirm },
        })
      ).statusCode,
    ).toBe(200);
    const unsub = makeNewsletterToken(
      subscriber.id,
      'unsubscribe',
      env.NEWSLETTER_UNSUBSCRIBE_SECRET,
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/newsletter/unsubscribe',
          headers: { 'x-forwarded-for': ip },
          payload: { id: subscriber.id, token: unsub },
        })
      ).statusCode,
    ).toBe(200);

    // Thư xác nhận cũ (forward đi đâu đó) KHÔNG bật lại được consent — cả GET lẫn POST.
    for (const method of ['GET', 'POST'] as const) {
      const res = await app.inject(
        method === 'GET'
          ? {
              method,
              url: `/api/newsletter/confirm?id=${subscriber.id}&token=${oldConfirm}`,
              headers: { 'x-forwarded-for': ip },
            }
          : {
              method,
              url: '/api/newsletter/confirm',
              headers: { 'x-forwarded-for': ip },
              payload: { id: subscriber.id, token: oldConfirm },
            },
      );
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('INVALID_CONFIRM_TOKEN');
    }
    const stillOff = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(stillOff.unsubscribedAt).toBeInstanceOf(Date);

    // Điền lại form trong 24h → không gửi (chống máy gửi thư); lùi welcomeSentAt quá 24h → gửi lại, key theo ngày.
    expect((await postSubscribe(app, { email }, ip)).statusCode).toBe(200);
    expect(await prisma.outbox.count({ where: { type: EmailType.NEWSLETTER_WELCOME } })).toBe(1);
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { welcomeSentAt: new Date(Date.now() - CONFIRM_RESEND_AFTER_MS - 1000) },
    });
    expect((await postSubscribe(app, { email }, ip)).statusCode).toBe(200);
    const day = new Date().toISOString().slice(0, 10);
    const resend = await prisma.outbox.findFirstOrThrow({
      where: { dedupeKey: `newsletter-confirm:${email}:${day}` },
    });
    const newConfirm = (resend.payload as Record<string, unknown>).confirmToken as string;
    expect(newConfirm).not.toBe(oldConfirm);

    // Chủ hộp thư bấm confirm trên thư MỚI → consent mở lại.
    const ok = await app.inject({
      method: 'POST',
      url: '/api/newsletter/confirm',
      headers: { 'x-forwarded-for': ip },
      payload: { id: subscriber.id, token: newConfirm },
    });
    expect(ok.statusCode).toBe(200);
    const back = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(back.unsubscribedAt).toBeNull();
    expect(back.confirmedAt).toBeInstanceOf(Date);
    // Mốc mới là consent MỚI (lớn hơn mốc confirm đầu), không phải mốc cũ giữ lại.
    expect(back.confirmedAt?.getTime() ?? 0).toBeGreaterThan(stillOff.confirmedAt?.getTime() ?? 0);
  });

  it('vòng vá review W4: chưa xác nhận, thư đầu quá 24h → điền lại form gửi LẠI thư xác nhận (một lần/ngày); đã xác nhận → không gửi gì', async () => {
    const email = 'optin.resend@example.com';
    const ip = '10.1.4.6';
    const subscriber = await createSubscriber(email, ip);
    // Trong 24h: không gửi lại.
    expect((await postSubscribe(app, { email }, ip)).statusCode).toBe(200);
    expect(await prisma.outbox.count({ where: { type: EmailType.NEWSLETTER_WELCOME } })).toBe(1);
    // Quá 24h, chưa confirm: gửi lại; lần nữa cùng ngày: dedupe theo ngày.
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { welcomeSentAt: new Date(Date.now() - CONFIRM_RESEND_AFTER_MS - 1000) },
    });
    expect((await postSubscribe(app, { email }, ip)).statusCode).toBe(200);
    expect(await prisma.outbox.count({ where: { type: EmailType.NEWSLETTER_WELCOME } })).toBe(2);
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { welcomeSentAt: new Date(Date.now() - CONFIRM_RESEND_AFTER_MS - 1000) },
    });
    expect((await postSubscribe(app, { email }, ip)).statusCode).toBe(200);
    expect(await prisma.outbox.count({ where: { type: EmailType.NEWSLETTER_WELCOME } })).toBe(2);
    // Đã xác nhận: điền lại form không sinh thư nào dù welcomeSentAt cũ.
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        confirmedAt: new Date(),
        welcomeSentAt: new Date(Date.now() - 10 * CONFIRM_RESEND_AFTER_MS),
      },
    });
    expect((await postSubscribe(app, { email }, ip)).statusCode).toBe(200);
    expect(await prisma.outbox.count({ where: { type: EmailType.NEWSLETTER_WELCOME } })).toBe(2);
  });
});

/**
 * Vá review Task 6 — Khoản 1: "đăng ký lại sau khi huỷ là ngõ cụt câm lặng".
 * Kịch bản gốc reviewer chạy: khách huỷ → đổi ý → tự điền lại form subscribe
 * → `subscribe()` cố tình KHÔNG reset `unsubscribedAt` (`update: {}` của
 * Task 5, chống đăng ký hộ người lạ) → khách không bao giờ nhận lại được gì
 * và không có đường tự sửa. Endpoint MỚI `resubscribe` dùng LẠI đúng token
 * HMAC của unsubscribe làm bằng chứng "chính chủ".
 */
describe('newsletter resubscribe (int)', () => {
  it('resubscribe sau khi huỷ → unsubscribedAt về null, bản tin kế tiếp gửi được (drain sent tăng, không còn skippedUnsubscribed)', async () => {
    const email = 'resub.happy@example.com';
    const subscriber = await createSubscriber(email, '10.1.2.1');
    const token = makeUnsubscribeToken(subscriber.id, env.NEWSLETTER_UNSUBSCRIBE_SECRET);

    const unsub = await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': '10.1.2.1' },
      payload: { id: subscriber.id, token },
    });
    expect(unsub.statusCode).toBe(200);

    // W4 E4: cửa resubscribe chỉ nhận token mục đích `resubscribe` (thực tế
    // panel lấy từ response POST huỷ; ở đây mint thẳng cho gọn — cùng hàm).
    const resubToken = makeNewsletterToken(
      subscriber.id,
      'resubscribe',
      env.NEWSLETTER_UNSUBSCRIBE_SECRET,
    );
    const resub = await app.inject({
      method: 'POST',
      url: '/api/newsletter/resubscribe',
      headers: { 'x-forwarded-for': '10.1.2.1' },
      payload: { id: subscriber.id, token: resubToken },
    });
    expect(resub.statusCode).toBe(200);
    expect(resub.json()).toEqual({ subscribed: true });

    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.unsubscribedAt).toBeNull();

    // Bằng chứng đầu-cuối, không chỉ tin response: bản tin kế tiếp KHÔNG còn
    // bị worker bỏ qua (đối chứng trực tiếp với test "worker bỏ qua
    // subscriber đã huỷ" phía trên) — đây chính là oracle bắt lỗi thật của
    // Khoản 1. Nếu `resubscribe` không thật sự reset `unsubscribedAt` trong
    // DB (chỉ giả vờ trả `{subscribed:true}`), `drainOnce()` dưới đây sẽ báo
    // `skippedUnsubscribed:1, sent:0` y hệt kịch bản lỗi gốc.
    await prisma.outbox.deleteMany();
    const enqueued = await outbox.enqueue(
      EmailType.NEWSLETTER_WELCOME,
      { email },
      `newsletter-welcome-resub:${email}`,
    );
    expect(enqueued).toBe(true);
    const result = await outbox.drainOnce();
    expect(result.sent).toBe(1);
    expect(result.skippedUnsubscribed).toBe(0);
    expect(fakeDeliverer.calls).toHaveLength(1);
  });

  it('resubscribe trên subscriber ĐANG active (chưa từng huỷ) → updatedAt KHÔNG đổi', async () => {
    // Mutation-test (task-6-report.md) đã phát hiện: bỏ guard
    // `unsubscribedAt: { not: null }` khỏi `resubscribe()` KHÔNG làm 3 test
    // phía trên đỏ — set `unsubscribedAt` null→null là no-op logic nên
    // response/DB state cuối cùng nhìn giống hệt. Oracle bắt lỗi thật nằm ở
    // cột `updatedAt @updatedAt` (schema.prisma): Prisma bơm
    // `updated_at = NOW()` cho MỌI hàng khớp WHERE, bất kể giá trị SET có
    // đổi hay không — guard chặn không cho `updateMany` chạm vào subscriber
    // đang active mới có tác dụng quan sát được qua cột này.
    const email = 'resub.already-active@example.com';
    const subscriber = await createSubscriber(email, '10.1.2.5');
    const token = makeNewsletterToken(
      subscriber.id,
      'resubscribe',
      env.NEWSLETTER_UNSUBSCRIBE_SECRET,
    );

    // Sentinel thay vì so `updatedAt` với giá trị lúc tạo: đẩy updatedAt về
    // mốc quá khứ xa bằng raw SQL (đi vòng @updatedAt của Prisma) để biên phát
    // hiện là HÀNG CHỤC NĂM, không phải vài millisecond. Oracle cũ chỉ đỏ khi
    // hai lần ghi rơi vào hai millisecond khác nhau (đo được: 4-19ms) — đúng
    // hướng an toàn nhưng phụ thuộc tốc độ máy một cách không cần thiết.
    const sentinel = new Date('2000-01-01T00:00:00.000Z');
    await prisma.$executeRaw`UPDATE subscribers SET updated_at = ${sentinel} WHERE id = ${subscriber.id}::uuid`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/resubscribe',
      headers: { 'x-forwarded-for': '10.1.2.5' },
      payload: { id: subscriber.id, token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ subscribed: true });

    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.updatedAt).toEqual(sentinel);
  });

  it('gọi resubscribe 2 lần vẫn 200 (idempotent)', async () => {
    const email = 'resub.twice@example.com';
    const subscriber = await createSubscriber(email, '10.1.2.2');
    const token = makeUnsubscribeToken(subscriber.id, env.NEWSLETTER_UNSUBSCRIBE_SECRET);
    await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': '10.1.2.2' },
      payload: { id: subscriber.id, token },
    });

    const payload = {
      id: subscriber.id,
      token: makeNewsletterToken(subscriber.id, 'resubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET),
    };
    const first = await app.inject({
      method: 'POST',
      url: '/api/newsletter/resubscribe',
      headers: { 'x-forwarded-for': '10.1.2.2' },
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ subscribed: true });

    const second = await app.inject({
      method: 'POST',
      url: '/api/newsletter/resubscribe',
      headers: { 'x-forwarded-for': '10.1.2.2' },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ subscribed: true });

    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.unsubscribedAt).toBeNull();
  });

  it('token sai → INVALID_UNSUBSCRIBE_TOKEN (400), unsubscribedAt KHÔNG đổi', async () => {
    const email = 'resub.badtoken@example.com';
    const subscriber = await createSubscriber(email, '10.1.2.3');
    const validToken = makeUnsubscribeToken(subscriber.id, env.NEWSLETTER_UNSUBSCRIBE_SECRET);
    await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe',
      headers: { 'x-forwarded-for': '10.1.2.3' },
      payload: { id: subscriber.id, token: validToken },
    });

    const wrongToken = makeUnsubscribeToken(subscriber.id, 'not-the-real-secret');
    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/resubscribe',
      headers: { 'x-forwarded-for': '10.1.2.3' },
      payload: { id: subscriber.id, token: wrongToken },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_UNSUBSCRIBE_TOKEN');

    const after = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } });
    expect(after.unsubscribedAt).toBeInstanceOf(Date);
  });

  it('GET tới /api/newsletter/resubscribe KHÔNG tồn tại — khẳng định không có biến thể GET', async () => {
    // Oracle bắt lỗi thật của yêu cầu "BẮT BUỘC POST, KHÔNG GET": nếu ai đó
    // lỡ thêm route GET song song (vd copy khuôn unsubscribeConfirm), email
    // client prefetch link để quét virus sẽ tự đăng ký lại đúng người VỪA
    // huỷ — route GET này phải KHÔNG tồn tại (404), không phải 400/401.
    const res = await app.inject({
      method: 'GET',
      url: '/api/newsletter/resubscribe',
      headers: { 'x-forwarded-for': '10.1.2.4' },
    });
    expect(res.statusCode).toBe(404);
  });
});
