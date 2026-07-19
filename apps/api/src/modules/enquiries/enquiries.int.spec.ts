import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { createFastifyAdapter } from '../../bootstrap.js';
import { adminEmails } from '../../config/env.js';
import { EmailType, EnquiryStatus } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Form liên hệ công khai P3a-B Task 4: endpoint GHI đầu tiên khách CHƯA
 * đăng nhập gọi được — @Public() (ADR-0003), honeypot KHÔNG reject, throttle
 * 5/60s theo IP, và outbox KÉP (ack khách + alert admin) trong CÙNG
 * transaction với insert enquiry.
 *
 * Dùng createFastifyAdapter() dùng chung với main.ts (trustProxy) thay vì tự
 * `new FastifyAdapter()` — thiếu nó thì test throttle theo IP sai (mọi
 * request `.inject()` trông như cùng một IP giả của socket).
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
  // Thứ tự truncate theo chiều phụ thuộc FK.
  await prisma.$executeRawUnsafe(
    'TRUNCATE enquiries, outbox, tours, tour_categories, destinations RESTART IDENTITY CASCADE',
  );
});

/** Dựng một tour đã publish, dùng slug làm khoá phân biệt giữa các test. */
async function createPublishedTour(slug: string) {
  const category = await prisma.tourCategory.create({
    data: { slug: `cat-${slug}`, name: 'Walking', order: 1 },
  });
  return prisma.tour.create({
    data: {
      slug,
      title: 'Hội An Walking Tour',
      categoryId: category.id,
      durationDays: 1,
      basePrice: '39.00',
      currency: 'USD',
      isPublished: true,
    },
  });
}

/** Payload hợp lệ tối thiểu — message đủ ≥10 ký tự để qua Zod. */
const VALID_PAYLOAD = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  message: 'I would like to know more about this tour, thanks!',
};

/** Gửi POST /api/enquiries, giả lập một IP riêng cho mỗi test (tránh đụng
 * chung bucket ThrottlerGuard trong-memory giữa các test không liên quan). */
function postEnquiry(
  app: NestFastifyApplication,
  payload: Record<string, unknown>,
  fakeIp: string,
) {
  return app.inject({
    method: 'POST',
    url: '/api/enquiries',
    headers: { 'x-forwarded-for': fakeIp },
    payload,
  });
}

describe('enquiries (int)', () => {
  it('tạo enquiry hợp lệ → 200, DB có 1 row status NEW, và CÙNG transaction sinh ĐÚNG 2 outbox', async () => {
    const res = await postEnquiry(app, VALID_PAYLOAD, '10.0.0.1');

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).not.toBeNull();

    const enquiry = await prisma.enquiry.findUniqueOrThrow({ where: { id: body.id } });
    expect(enquiry.status).toBe(EnquiryStatus.NEW);
    expect(enquiry.name).toBe(VALID_PAYLOAD.name);

    // Đúng 2 outbox, gắn ĐÚNG dedupeKey theo quy ước <event>:<entityId>.
    const outboxRows = await prisma.outbox.findMany({
      where: { dedupeKey: { contains: body.id } },
    });
    expect(outboxRows).toHaveLength(2);
    const received = outboxRows.find((r) => r.dedupeKey === `enquiry-received:${body.id}`);
    const alert = outboxRows.find((r) => r.dedupeKey === `enquiry-admin-alert:${body.id}`);
    expect(received?.type).toBe(EmailType.ENQUIRY_RECEIVED);
    expect(alert?.type).toBe(EmailType.ENQUIRY_ADMIN_ALERT);
  });

  it('alert đi tới ADMIN, không tới khách — payload.to = adminEmails[0], khác email khách', async () => {
    // Đây là lỗi đã suýt lọt: deliver() mặc định lấy người nhận từ
    // payload.email, mà ở ENQUIRY_ADMIN_ALERT email đó là địa chỉ KHÁCH.
    const res = await postEnquiry(app, VALID_PAYLOAD, '10.0.0.2');
    const id = res.json().id as string;

    const alert = await prisma.outbox.findFirstOrThrow({
      where: { dedupeKey: `enquiry-admin-alert:${id}` },
    });
    const payload = alert.payload as Record<string, unknown>;
    expect(payload.to).toBe(adminEmails[0]);
    expect(payload.to).not.toBe(VALID_PAYLOAD.email);
    // Email khách vẫn phải có mặt trong payload để admin đọc trong nội dung.
    expect(payload.email).toBe(VALID_PAYLOAD.email);
  });

  it('outbox thứ hai (ENQUIRY_ADMIN_ALERT) ghi lỗi giữa transaction → enquiry KHÔNG được lưu, không outbox mồ côi', async () => {
    // Mutation-test ở Task 4 phát hiện: tách hai lệnh ghi outbox ra khỏi
    // `$transaction` thì KHÔNG test nào đỏ — 7 test còn lại chỉ assert trạng
    // thái DB SAU một lời gọi THÀNH CÔNG, giống hệt nhau dù ghi nguyên tử
    // hay tuần tự. Test này ép chính lệnh ghi outbox THỨ HAI lỗi GIỮA
    // transaction để chứng minh rollback thật xảy ra.
    //
    // Không đoán trước được `dedupeKey` (chứa id enquiry — `uuid(7)` Prisma
    // sinh phía client lúc insert, không dự đoán được) nên không "cài sẵn"
    // một row outbox trùng dedupeKey như cách thông thường. Thay vào đó,
    // thêm TẠM một CHECK constraint chặn mọi insert `type = ENQUIRY_ADMIN_ALERT`
    // — độc lập với id. Vì `createMany` gộp CẢ HAI outbox vào MỘT câu lệnh
    // INSERT, vi phạm ở row thứ hai làm hỏng CẢ CÂU LỆNH → lỗi văng ra bên
    // trong callback `$transaction` → Postgres ROLLBACK toàn bộ, bao gồm cả
    // row `enquiry` vừa ghi trước đó trong CÙNG transaction.
    await prisma.$executeRawUnsafe(`
      ALTER TABLE outbox ADD CONSTRAINT enquiries_int_spec_block_admin_alert
      CHECK (type <> 'ENQUIRY_ADMIN_ALERT')
    `);
    try {
      const marker = 'Atomicity Rollback Marker';
      const res = await postEnquiry(app, { ...VALID_PAYLOAD, name: marker }, '10.0.0.7');

      // Lời gọi PHẢI thất bại — lỗi không lường trước (không phải
      // TOUR_NOT_FOUND/validate), oRPC trả shape INTERNAL_SERVER_ERROR (xem
      // onError interceptor ở app.module.ts).
      expect(res.statusCode).toBeGreaterThanOrEqual(500);

      // Điều CỐT LÕI cần chứng minh: row enquiry KHÔNG tồn tại trong DB —
      // transaction đã rollback, không dừng lại giữa chừng với enquiry đã
      // lưu mà outbox thì thiếu.
      expect(await prisma.enquiry.findFirst({ where: { name: marker } })).toBeNull();

      // Không outbox mồ côi nào — kể cả ENQUIRY_RECEIVED (row đầu trong cùng
      // `createMany`, hợp lệ riêng lẻ nhưng phải rollback theo cả câu lệnh).
      // Tìm theo nội dung payload vì id chưa từng sinh ra thành công.
      const orphaned = await prisma.outbox.findMany({
        where: { payload: { path: ['name'], equals: marker } },
      });
      expect(orphaned).toHaveLength(0);
    } finally {
      // Dọn constraint TẠM — TRUNCATE ở beforeEach không xoá được nó.
      await prisma.$executeRawUnsafe(
        'ALTER TABLE outbox DROP CONSTRAINT enquiries_int_spec_block_admin_alert',
      );
    }
  });

  it('honeypot: website có giá trị → 200 GIẢ (CÙNG status thành công), id null, DB không có row nào mới', async () => {
    const before = await prisma.enquiry.count();

    const res = await postEnquiry(
      app,
      { ...VALID_PAYLOAD, website: 'http://spam.example' },
      '10.0.0.3',
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBeNull();
    expect(await prisma.enquiry.count()).toBe(before);
    expect(await prisma.outbox.count()).toBe(0);
  });

  it('message 9 ký tự → lỗi validate (400)', async () => {
    const res = await postEnquiry(app, { ...VALID_PAYLOAD, message: '123456789' }, '10.0.0.4');

    expect(res.statusCode).toBe(400);
    expect(await prisma.enquiry.count()).toBe(0);
  });

  it('tourId trỏ tour chưa publish → TOUR_NOT_FOUND, không ghi enquiry lẫn outbox', async () => {
    const category = await prisma.tourCategory.create({
      data: { slug: 'cat-draft', name: 'Draft', order: 1 },
    });
    const draft = await prisma.tour.create({
      data: {
        slug: 'chua-xuat-ban',
        title: 'Tour chưa xuất bản',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: false,
      },
    });

    const res = await postEnquiry(app, { ...VALID_PAYLOAD, tourId: draft.id }, '10.0.0.5');

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('TOUR_NOT_FOUND');
    expect(await prisma.enquiry.count()).toBe(0);
    expect(await prisma.outbox.count()).toBe(0);
  });

  it('email lưu dạng citext: gửi Jane@X.com rồi query jane@x.com phải khớp (kèm tourId hợp lệ)', async () => {
    // Gắn kèm tourId đã publish để cùng lúc xác nhận nhánh publish chạy
    // đúng — tourTitle phải lọt vào outbox payload chung của cả hai email.
    const tour = await createPublishedTour('hoi-an-walking-tour');

    const res = await postEnquiry(
      app,
      { ...VALID_PAYLOAD, email: 'Jane@X.com', tourId: tour.id },
      '10.0.0.6',
    );
    expect(res.statusCode).toBe(200);

    const found = await prisma.enquiry.findFirst({ where: { email: 'jane@x.com' } });
    expect(found).not.toBeNull();
    expect(found?.id).toBe(res.json().id);
    expect(found?.tourId).toBe(tour.id);

    const received = await prisma.outbox.findFirstOrThrow({
      where: { dedupeKey: `enquiry-received:${res.json().id}` },
    });
    expect((received.payload as Record<string, unknown>).tourTitle).toBe(tour.title);
  });

  it('throttle: gửi 6 lần liên tiếp cùng IP → lần thứ 6 trả 429, DB chỉ có 5 row', async () => {
    const ip = '10.0.0.8';
    for (let i = 1; i <= 5; i++) {
      const res = await postEnquiry(app, VALID_PAYLOAD, ip);
      expect(res.statusCode, `request thứ ${i} phải qua`).toBe(200);
    }
    const sixth = await postEnquiry(app, VALID_PAYLOAD, ip);
    expect(sixth.statusCode).toBe(429);
    expect(await prisma.enquiry.count()).toBe(5);
  });
});
