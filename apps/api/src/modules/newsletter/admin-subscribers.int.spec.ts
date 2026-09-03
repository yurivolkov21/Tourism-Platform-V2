import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminSubscribersListResultSchema,
  AdminSubscriberUnsubscribeResultSchema,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Integration (Docker PG, db tourism_test) — vùng subscribers admin (spec P4c
 * §3-F10): list (cờ ba-trạng-thái `active` + tìm email + lọc `source` + danh
 * sách `sources` + phân trang + guard) và unsubscribe (một câu UPDATE có
 * guard; đã huỷ → 409 và mốc CŨ không bị đè; id lạ → 404).
 *
 * Fixture ghi THẲNG vào `subscribers` (không đi qua form footer): endpoint
 * admin chỉ đọc/sửa bảng, còn đường ghi công khai đã có `newsletter.int.spec.ts`
 * canh (kể cả honeypot, dedupe welcome và token HMAC).
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)
const CUSTOMER_EMAIL = 'subscribers-customer@tourism.test';

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

const MINUTE = 60_000;
const at = (minutesAgo: number): Date => new Date(Date.now() - minutesAgo * MINUTE);

/** Mốc rút consent CỐ ĐỊNH của fixture — phải sống sót qua mọi lệnh 409. */
const UNSUBSCRIBED_AT = new Date('2026-08-01T09:00:00.000Z');

describe('admin subscribers integration (F10)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;

  const rowId = (n: number) => `fa000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const MISSING_ID = 'fa000001-0000-4000-8000-999999999999';

  function subscriber(
    n: number,
    patch: Partial<Prisma.SubscriberCreateManyInput> = {},
  ): Prisma.SubscriberCreateManyInput {
    return {
      id: rowId(n),
      email: `sub${n}@example.com`,
      source: null,
      createdAt: at(n),
      updatedAt: at(n),
      ...patch,
    };
  }

  const list = (query: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/admin/subscribers${query}`, headers: { cookie } });

  const unsubscribe = (id: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/subscribers/${id}/unsubscribe`,
      headers: { cookie },
      payload: {},
    });

  const listOk = async (query: string) => {
    const res = await list(query, adminCookie);
    expect(res.statusCode).toBe(200);
    return AdminSubscribersListResultSchema.parse(res.json());
  };

  const ids = (result: { items: { id: string }[] }) => result.items.map((item) => item.id);

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users, subscribers CASCADE');

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
    await prisma.subscriber.deleteMany();
    await prisma.subscriber.createMany({
      data: [
        // n = số phút trước → n nhỏ = mới nhất. Thứ tự mong đợi: 1..7.
        subscriber(1, { email: 'ada@example.com', source: 'footer' }),
        subscriber(2, {
          email: 'grace@example.com',
          source: 'footer',
          unsubscribedAt: UNSUBSCRIBED_AT,
        }),
        // Email viết HOA ở fixture — cột citext, `contains` phải là ILIKE.
        subscriber(3, { email: 'ALAN@example.com', source: 'popup' }),
        // `source` null: đúng hình dạng mọi hàng thật hôm nay (form footer
        // của web gọi `subscribe({email})` không kèm nguồn).
        subscriber(4, { email: 'katherine@example.com' }),
        subscriber(5, { email: 'margaret@example.com', unsubscribedAt: UNSUBSCRIBED_AT }),
        // Cặp `a_b` / `axb`: nếu `_` lọt vào LIKE như wildcard thì tìm "a_b"
        // kéo về cả hai (escapeLike — cùng bẫy đã dính ở F9).
        subscriber(6, { email: 'a_b@example.com', source: 'landing-2026' }),
        subscriber(7, { email: 'axb@example.com', source: 'landing-2026' }),
      ],
    });
  });

  afterAll(async () => {
    await prisma.subscriber.deleteMany();
    await app.close();
    await prisma.$disconnect();
  });

  describe('guard — cùng lớp với mọi endpoint admin, phủ CẢ HAI', () => {
    it('list: ẩn danh → 401, khách thường → 403', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/admin/subscribers' })).statusCode).toBe(
        401,
      );
      expect((await list('', customerCookie)).statusCode).toBe(403);
    });

    it('unsubscribe: ẩn danh → 401, khách thường → 403 — và KHÔNG ghi gì', async () => {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/admin/subscribers/${rowId(1)}/unsubscribe`,
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      expect((await unsubscribe(rowId(1), customerCookie)).statusCode).toBe(403);
      // Guard chạy TRƯỚC oRPC: không hàng nào rời danh sách.
      expect(await prisma.subscriber.count({ where: { unsubscribedAt: null } })).toBe(5);
    });
  });

  describe('list', () => {
    it('không filter: mọi hàng, mới nhất trước, đủ shape contract — KHÔNG chở `updatedAt`', async () => {
      const res = await list('', adminCookie);
      expect(res.statusCode).toBe(200);
      const paged = AdminSubscribersListResultSchema.parse(res.json());
      expect(paged.total).toBe(7);
      expect(ids(paged)).toEqual([1, 2, 3, 4, 5, 6, 7].map(rowId));
      expect(paged.items[0]).toMatchObject({
        email: 'ada@example.com',
        source: 'footer',
        unsubscribedAt: null,
      });
      expect(res.body).not.toContain('"updatedAt"');
    });

    it('`active` là ba trạng thái: true = còn nhận · false = đã huỷ · vắng = mọi hàng', async () => {
      // Ép boolean từ QUERY STRING thật (ZodSmartCoercionPlugin), không phải
      // từ typed client — đúng đường mà trang admin đi.
      expect(ids(await listOk('?active=true'))).toEqual([1, 3, 4, 6, 7].map(rowId));
      expect(ids(await listOk('?active=false'))).toEqual([2, 5].map(rowId));
      expect((await listOk('')).total).toBe(7);
    });

    it('search khớp email contains, không phân biệt hoa/thường (cột citext + ILIKE)', async () => {
      expect(ids(await listOk('?search=ALAN'))).toEqual([rowId(3)]);
      expect(ids(await listOk('?search=grace@'))).toEqual([rowId(2)]);
      expect((await listOk('?search=example.com')).total).toBe(7);
    });

    it('search: `%` và `_` là ký tự THƯỜNG, không phải wildcard (escapeLike)', async () => {
      expect((await listOk('?search=%25')).total).toBe(0);
      // Không escape thì `_` khớp một ký tự bất kỳ và `axb@` cũng lọt.
      expect(ids(await listOk('?search=a_b'))).toEqual([rowId(6)]);
    });

    it('search kết hợp `active` là GIAO, không phải hợp', async () => {
      expect(ids(await listOk('?search=example.com&active=false'))).toEqual([2, 5].map(rowId));
    });

    it('source lọc đúng một nguồn; nguồn không ai khai → tập rỗng', async () => {
      expect(ids(await listOk('?source=footer'))).toEqual([1, 2].map(rowId));
      expect(ids(await listOk('?source=popup'))).toEqual([rowId(3)]);
      expect((await listOk('?source=never-used')).total).toBe(0);
    });

    it('`sources` là distinct TOÀN BẢNG, sắp a→z, KHÔNG có null', async () => {
      expect((await listOk('')).sources).toEqual(['footer', 'landing-2026', 'popup']);
    });

    it('`sources` KHÔNG co lại theo bộ lọc đang áp — Select không tự cắt lựa chọn của mình', async () => {
      expect((await listOk('?source=popup')).sources).toEqual(['footer', 'landing-2026', 'popup']);
      expect((await listOk('?active=false')).sources).toEqual(['footer', 'landing-2026', 'popup']);
    });

    it('`includeSources=false` (đường export) → `sources` rỗng, hàng vẫn đủ — không GROUP BY thừa', async () => {
      const paged = await listOk('?includeSources=false');
      expect(paged.sources).toEqual([]);
      expect(paged.total).toBe(7);
    });

    it('phân trang: page/limit ép từ query string, totalPages đúng', async () => {
      const page2 = await listOk('?limit=2&page=2');
      expect(page2).toMatchObject({ page: 2, limit: 2, total: 7, totalPages: 4 });
      expect(ids(page2)).toEqual([rowId(3), rowId(4)]);
    });

    it('active không phải boolean / source vượt trần cột → 400 (contract chặn trước DB)', async () => {
      expect((await list('?active=yes', adminCookie)).statusCode).toBe(400);
      expect((await list(`?source=${'x'.repeat(41)}`, adminCookie)).statusCode).toBe(400);
    });
  });

  describe('unsubscribe', () => {
    it('hàng đang nhận tin → 200, ghi mốc THẬT vào DB, không đụng hàng khác', async () => {
      const before = Date.now();
      const res = await unsubscribe(rowId(1), adminCookie);
      expect(res.statusCode).toBe(200);
      const body = AdminSubscriberUnsubscribeResultSchema.parse(res.json());
      expect(body.id).toBe(rowId(1));

      const db = await prisma.subscriber.findUniqueOrThrow({ where: { id: rowId(1) } });
      // Mốc trong response CHÍNH LÀ mốc câu UPDATE ghi xuống — không phải một
      // lượt đọc lại, và không phải giờ của client.
      expect(db.unsubscribedAt?.toISOString()).toBe(body.unsubscribedAt);
      expect(db.unsubscribedAt?.getTime()).toBeGreaterThanOrEqual(before);
      // Địa chỉ ở lại bảng: huỷ là ghi mốc, không phải xoá hàng (spec §2.4).
      expect(db.email).toBe('ada@example.com');
      expect(await prisma.subscriber.count()).toBe(7);
      expect(await prisma.subscriber.count({ where: { unsubscribedAt: null } })).toBe(4);
    });

    it('hàng ĐÃ huỷ (seed sẵn HOẶC vừa bấm lần một) → 409 ALREADY_UNSUBSCRIBED, mốc consent CŨ không bị đè', async () => {
      const res = await unsubscribe(rowId(2), adminCookie);
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'ALREADY_UNSUBSCRIBED' });
      const db = await prisma.subscriber.findUniqueOrThrow({ where: { id: rowId(2) } });
      expect(db.unsubscribedAt?.toISOString()).toBe(UNSUBSCRIBED_AT.toISOString());

      const first = AdminSubscriberUnsubscribeResultSchema.parse(
        (await unsubscribe(rowId(3), adminCookie)).json(),
      );
      expect((await unsubscribe(rowId(3), adminCookie)).statusCode).toBe(409);
      const again = await prisma.subscriber.findUniqueOrThrow({ where: { id: rowId(3) } });
      expect(again.unsubscribedAt?.toISOString()).toBe(first.unsubscribedAt);
    });

    it('id không tồn tại → 404 NOT_FOUND; id không phải uuid → 400', async () => {
      const missing = await unsubscribe(MISSING_ID, adminCookie);
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect((await unsubscribe('not-a-uuid', adminCookie)).statusCode).toBe(400);
    });
  });
});
