import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  EmailTypeSchema,
  OUTBOX_MAX_ATTEMPTS,
  OutboxRowSchema,
  PagedSchema,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { EmailType, OutboxStatus } from '../../generated/prisma/enums.js';
import { MAX_ATTEMPTS } from '../../worker/outbox.service.js';

/**
 * Integration (Docker PG, db tourism_test) — vùng outbox admin (spec P4c
 * §3-F7): list (filter status/type + tìm dedupeKey + phân trang + guard) và
 * retry (chỉ FAILED → PENDING, attempts 0, GIỮ lastError; PENDING/SENT →
 * NOT_FAILED; id lạ → NOT_FOUND).
 *
 * Không có worker nào chạy trong test: retry chỉ đổi trạng thái hàng, việc
 * gửi lại là của lượt drain kế — đúng thứ endpoint hứa.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)
const CUSTOMER_EMAIL = 'outbox-customer@tourism.test';

const PagedOutboxSchema = PagedSchema(OutboxRowSchema);

/** Lấy cookie pair (name=value) từ set-cookie của inject response. */
function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  if (!session) throw new Error(`No session cookie in: ${JSON.stringify(raw)}`);
  const pair = session.split(';')[0];
  if (!pair) throw new Error('Malformed set-cookie');
  return pair;
}

const DAY = 86_400_000;
const at = (minutesAgo: number): Date => new Date(Date.now() - minutesAgo * 60_000);

describe('admin outbox integration (F7)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;

  const rowId = (n: number) => `f7000001-0000-4000-8000-${String(n).padStart(12, '0')}`;

  function row(
    n: number,
    patch: Partial<Prisma.OutboxCreateManyInput> & { dedupeKey: string },
  ): Prisma.OutboxCreateManyInput {
    return {
      id: rowId(n),
      type: EmailType.BOOKING_CONFIRMATION,
      payload: { code: `BK-OUTB000${n}`, email: `guest${n}@example.com` },
      status: OutboxStatus.PENDING,
      attempts: 0,
      createdAt: at(n),
      ...patch,
    };
  }

  const list = (query: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/admin/outbox${query}`, headers: { cookie } });

  const retry = (id: string, cookie: string) =>
    app.inject({ method: 'POST', url: `/api/admin/outbox/${id}/retry`, headers: { cookie } });

  const listOk = async (query: string) => {
    const res = await list(query, adminCookie);
    expect(res.statusCode).toBe(200);
    return PagedOutboxSchema.parse(res.json());
  };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users, outbox CASCADE');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    for (const email of [ADMIN_EMAIL, CUSTOMER_EMAIL]) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name: 'Test User' },
      });
      await prisma.user.update({
        where: { email },
        data: { emailVerified: true, ...(email === ADMIN_EMAIL ? { role: 'ADMIN' } : {}) },
      });
    }
    adminCookie = sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: ADMIN_EMAIL, password: PASSWORD },
      }),
    );
    customerCookie = sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: CUSTOMER_EMAIL, password: PASSWORD },
      }),
    );
  });

  beforeEach(async () => {
    // Sign-up ở trên có thể đã enqueue email verify — dọn để tập fixture là
    // toàn bộ những gì bảng có.
    await prisma.outbox.deleteMany();
    await prisma.outbox.createMany({
      data: [
        // n = số phút trước → n nhỏ = mới nhất. Thứ tự mong đợi: 1,2,3,4,5.
        row(1, {
          dedupeKey: 'booking-confirmation:BK-OUTB0001',
          status: OutboxStatus.FAILED,
          attempts: MAX_ATTEMPTS,
          lastError: 'Resend: 401 invalid api key',
        }),
        row(2, {
          dedupeKey: 'review-approved:rv-0002',
          type: EmailType.REVIEW_APPROVED,
          status: OutboxStatus.SENT,
          attempts: 1,
          lastError: 'timeout once',
          processedAt: at(1),
        }),
        row(3, {
          dedupeKey: 'booking-confirmation:BK-OUTB0003',
          status: OutboxStatus.PENDING,
        }),
        row(4, {
          dedupeKey: 'enquiry-admin-alert:e-0004',
          type: EmailType.ENQUIRY_ADMIN_ALERT,
          payload: { email: 'lead@example.com', to: 'ops@nexora.test' },
          status: OutboxStatus.SENT,
          processedAt: at(3),
        }),
        row(5, {
          dedupeKey: 'booking-confirmation:BK-OUTB0005',
          status: OutboxStatus.FAILED,
          attempts: MAX_ATTEMPTS,
          lastError: 'Resend: 429 rate limited',
          createdAt: new Date(Date.now() - 3 * DAY),
        }),
      ],
    });
  });

  afterAll(async () => {
    await prisma.outbox.deleteMany();
    await app.close();
    await prisma.$disconnect();
  });

  it('enum EmailType của contract soi gương đúng enum Prisma', () => {
    expect([...EmailTypeSchema.options]).toEqual(Object.values(EmailType));
  });

  it('MAX_ATTEMPTS của worker là chính hằng contract — một nguồn cho cột "3/5"', () => {
    expect(MAX_ATTEMPTS).toBe(OUTBOX_MAX_ATTEMPTS);
  });

  describe('guard — cùng lớp với mọi endpoint admin', () => {
    it('list: ẩn danh → 401, khách thường → 403', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/admin/outbox' })).statusCode).toBe(401);
      expect((await list('', customerCookie)).statusCode).toBe(403);
    });

    it('retry: ẩn danh → 401, khách thường → 403 — và KHÔNG đụng hàng', async () => {
      expect(
        (await app.inject({ method: 'POST', url: `/api/admin/outbox/${rowId(1)}/retry` }))
          .statusCode,
      ).toBe(401);
      expect((await retry(rowId(1), customerCookie)).statusCode).toBe(403);
      const untouched = await prisma.outbox.findUniqueOrThrow({ where: { id: rowId(1) } });
      expect(untouched.status).toBe(OutboxStatus.FAILED);
    });
  });

  describe('list', () => {
    it('không filter: mọi row, mới nhất trước, đủ shape contract + recipient rút từ payload', async () => {
      const paged = await listOk('');
      expect(paged.total).toBe(5);
      expect(paged.items.map((item) => item.id)).toEqual([1, 2, 3, 4, 5].map(rowId));
      // `to` thắng `email` — cùng luật worker gửi.
      expect(paged.items[3]?.recipient).toBe('ops@nexora.test');
      expect(paged.items[0]).toMatchObject({
        type: 'BOOKING_CONFIRMATION',
        status: 'FAILED',
        attempts: MAX_ATTEMPTS,
        lastError: 'Resend: 401 invalid api key',
        recipient: 'guest1@example.com',
        processedAt: null,
        payload: { code: 'BK-OUTB0001', email: 'guest1@example.com' },
      });
    });

    it('status=FAILED chỉ trả hàng FAILED', async () => {
      const paged = await listOk('?status=FAILED');
      expect(paged.items.map((item) => item.id)).toEqual([rowId(1), rowId(5)]);
    });

    it('type lọc theo EmailType', async () => {
      const paged = await listOk('?type=REVIEW_APPROVED');
      expect(paged.items.map((item) => item.id)).toEqual([rowId(2)]);
    });

    it('search khớp dedupeKey contains — cách tra "email của đơn này đâu"', async () => {
      const paged = await listOk('?search=BK-OUTB0005');
      expect(paged.items.map((item) => item.id)).toEqual([rowId(5)]);
      // Kết hợp với status: giao của hai tập.
      const both = await listOk('?search=booking-confirmation&status=PENDING');
      expect(both.items.map((item) => item.id)).toEqual([rowId(3)]);
    });

    it('phân trang: page/limit ép từ query string, totalPages đúng', async () => {
      const page2 = await listOk('?limit=2&page=2');
      expect(page2).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
      expect(page2.items.map((item) => item.id)).toEqual([rowId(3), rowId(4)]);
    });

    it('status/type ngoài enum → 400 (contract chặn trước khi chạm DB)', async () => {
      expect((await list('?status=DONE', adminCookie)).statusCode).toBe(400);
      expect((await list('?type=NEWSLETTER', adminCookie)).statusCode).toBe(400);
    });
  });

  describe('retry', () => {
    it('FAILED → PENDING, attempts 0, GIỮ lastError, processedAt vẫn null; trả row sau khi đặt lại', async () => {
      const res = await retry(rowId(1), adminCookie);
      expect(res.statusCode).toBe(200);
      const body = OutboxRowSchema.parse(res.json());
      expect(body).toMatchObject({
        id: rowId(1),
        status: 'PENDING',
        attempts: 0,
        lastError: 'Resend: 401 invalid api key',
        processedAt: null,
      });
      const db = await prisma.outbox.findUniqueOrThrow({ where: { id: rowId(1) } });
      expect(db.status).toBe(OutboxStatus.PENDING);
      expect(db.attempts).toBe(0);
      expect(db.lastError).toBe('Resend: 401 invalid api key');
    });

    it('hàng PENDING → 409 NOT_FAILED, không đổi gì', async () => {
      const res = await retry(rowId(3), adminCookie);
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'NOT_FAILED' });
    });

    it('hàng SENT → 409 NOT_FAILED — email đã đi, không gửi lại', async () => {
      const res = await retry(rowId(2), adminCookie);
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'NOT_FAILED' });
      const db = await prisma.outbox.findUniqueOrThrow({ where: { id: rowId(2) } });
      expect(db.status).toBe(OutboxStatus.SENT);
      expect(db.attempts).toBe(1);
    });

    it('id không tồn tại → 404 NOT_FOUND; id không phải uuid → 400', async () => {
      const missing = await retry('f7000001-0000-4000-8000-999999999999', adminCookie);
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect((await retry('not-a-uuid', adminCookie)).statusCode).toBe(400);
    });

    it('retry hai lần liên tiếp: lần hai là NOT_FAILED (hàng đã về PENDING)', async () => {
      expect((await retry(rowId(5), adminCookie)).statusCode).toBe(200);
      expect((await retry(rowId(5), adminCookie)).statusCode).toBe(409);
    });
  });
});
