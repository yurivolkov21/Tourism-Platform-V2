import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  EnquiryDetailSchema,
  EnquiryRowSchema,
  EnquiryStatusSchema,
  PagedSchema,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { EnquiryStatus } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test) — vùng enquiries admin (spec P4c
 * §3-F9): list (filter status/search/tourId + phân trang + guard), byId
 * (message + thread note + lịch sử trạng thái), và HAI hành vi ghi —
 * `setStatus` (audit row đúng from/to/adminId, no-op khi trùng trạng thái) và
 * `addNote` (authorName lấy từ phiên).
 *
 * Fixture ghi THẲNG vào `enquiries` (không đi qua form công khai): endpoint
 * admin chỉ đọc/sửa bảng, còn đường ghi của khách đã có `enquiries.int.spec.ts`
 * canh (kể cả honeypot và hai outbox).
 */

const PUBLISHED_SLUG = 'hoi-an-lantern-evening';
const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)
const CUSTOMER_EMAIL = 'enquiries-customer@tourism.test';
const ADMIN_NAME = 'Test User'; // tên đăng ký ở sign-up bên dưới

const PagedRowsSchema = PagedSchema(EnquiryRowSchema);

function requireFixtureTour(slug: string) {
  const found = catalog.tours.find((t) => t.slug === slug);
  if (!found) throw new Error(`fixture tour missing: ${slug}`);
  return found;
}

const tour = requireFixtureTour(PUBLISHED_SLUG);

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

describe('admin enquiries integration (F9)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let adminId: string;

  const rowId = (n: number) => `f9000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const MISSING_ID = 'f9000001-0000-4000-8000-999999999999';

  function enquiry(
    n: number,
    patch: Partial<Prisma.EnquiryCreateManyInput> = {},
  ): Prisma.EnquiryCreateManyInput {
    return {
      id: rowId(n),
      name: `Lead ${n}`,
      email: `lead${n}@example.com`,
      message: `Message body number ${n} — long enough to pass validation.`,
      status: EnquiryStatus.NEW,
      createdAt: at(n),
      updatedAt: at(n),
      ...patch,
    };
  }

  const list = (query: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/admin/enquiries${query}`, headers: { cookie } });

  const byId = (id: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/admin/enquiries/${id}`, headers: { cookie } });

  const setStatus = (id: string, status: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/enquiries/${id}/status`,
      headers: { cookie },
      payload: { status },
    });

  const addNote = (id: string, body: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/enquiries/${id}/notes`,
      headers: { cookie },
      payload: { body },
    });

  const listOk = async (query: string) => {
    const res = await list(query, adminCookie);
    expect(res.statusCode).toBe(200);
    return PagedRowsSchema.parse(res.json());
  };

  const detailOk = async (id: string) => {
    const res = await byId(id, adminCookie);
    expect(res.statusCode).toBe(200);
    return EnquiryDetailSchema.parse(res.json());
  };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE tour_categories, destinations, users, enquiries CASCADE',
    );
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });
    await prisma.destination.createMany({ data: catalog.destinations });
    await prisma.tour.createMany({ data: [tour] as unknown as Prisma.TourCreateManyInput[] });

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
        payload: { email, password: PASSWORD, name: ADMIN_NAME },
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
    adminId = (await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } })).id;
  });

  beforeEach(async () => {
    // CASCADE dọn luôn notes + status events của các row cũ.
    await prisma.enquiry.deleteMany();
    await prisma.enquiry.createMany({
      data: [
        // n = số phút trước → n nhỏ = mới nhất. Thứ tự mong đợi: 1..6.
        enquiry(1, {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          phone: '+84 90 000 0001',
          tourId: tour.id,
          nationality: 'United Kingdom',
          travelDate: new Date('2026-12-24T00:00:00.000Z'),
          groupSize: 4,
          budgetTier: 'luxury',
          interests: ['food', 'photography'],
        }),
        enquiry(2, { name: 'Grace Hopper', status: EnquiryStatus.CONTACTED, tourId: tour.id }),
        enquiry(3, {
          name: 'Alan Turing',
          email: 'ALAN@example.com',
          status: EnquiryStatus.QUOTED,
        }),
        enquiry(4, { name: 'Katherine Johnson', status: EnquiryStatus.WON }),
        enquiry(5, { name: 'Margaret Hamilton', status: EnquiryStatus.LOST }),
        enquiry(6, { name: 'Radia Perlman' }),
      ],
    });
  });

  afterAll(async () => {
    await prisma.enquiry.deleteMany();
    await app.close();
    await prisma.$disconnect();
  });

  it('enum EnquiryStatus của contract soi gương đúng enum Prisma', () => {
    expect([...EnquiryStatusSchema.options]).toEqual(Object.values(EnquiryStatus));
  });

  describe('guard — cùng lớp với mọi endpoint admin, phủ CẢ BỐN', () => {
    it('list: ẩn danh → 401, khách thường → 403', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/admin/enquiries' })).statusCode).toBe(
        401,
      );
      expect((await list('', customerCookie)).statusCode).toBe(403);
    });

    it('byId: ẩn danh → 401, khách thường → 403', async () => {
      expect(
        (await app.inject({ method: 'GET', url: `/api/admin/enquiries/${rowId(1)}` })).statusCode,
      ).toBe(401);
      expect((await byId(rowId(1), customerCookie)).statusCode).toBe(403);
    });

    it('setStatus: ẩn danh → 401, khách thường → 403 — và KHÔNG ghi gì', async () => {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/admin/enquiries/${rowId(1)}/status`,
            payload: { status: 'WON' },
          })
        ).statusCode,
      ).toBe(401);
      expect((await setStatus(rowId(1), 'WON', customerCookie)).statusCode).toBe(403);
      // Guard chạy TRƯỚC oRPC: không row nào đổi, không event nào được nối.
      expect(await prisma.enquiryStatusEvent.count()).toBe(0);
      expect((await prisma.enquiry.findUniqueOrThrow({ where: { id: rowId(1) } })).status).toBe(
        EnquiryStatus.NEW,
      );
    });

    it('addNote: ẩn danh → 401, khách thường → 403 — và KHÔNG ghi gì', async () => {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/admin/enquiries/${rowId(1)}/notes`,
            payload: { body: 'sneaky' },
          })
        ).statusCode,
      ).toBe(401);
      expect((await addNote(rowId(1), 'sneaky', customerCookie)).statusCode).toBe(403);
      expect(await prisma.enquiryNote.count()).toBe(0);
    });
  });

  describe('list', () => {
    it('không filter: mọi row, mới nhất trước, đủ shape contract, KHÔNG mang message', async () => {
      const res = await list('', adminCookie);
      expect(res.statusCode).toBe(200);
      const paged = PagedRowsSchema.parse(res.json());
      expect(paged.total).toBe(6);
      expect(paged.items.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6].map(rowId));
      expect(paged.items[0]).toMatchObject({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '+84 90 000 0001',
        tourTitle: tour.title,
        tourSlug: PUBLISHED_SLUG,
        travelDate: '2026-12-24',
        groupSize: 4,
        budgetTier: 'luxury',
        status: 'NEW',
        notesCount: 0,
      });
      // Message tới 2000 ký tự — bảng không cần, list không chở (spec §3-F9).
      expect(res.body).not.toContain('"message"');
      expect(res.body).not.toContain('"interests"');
    });

    it('enquiry chung: CẢ HAI field tour null, các field optional vắng mặt cũng null', async () => {
      const paged = await listOk('');
      const generic = paged.items.find((item) => item.id === rowId(6));
      expect(generic).toMatchObject({
        tourTitle: null,
        tourSlug: null,
        phone: null,
        travelDate: null,
        groupSize: null,
        budgetTier: null,
      });
    });

    it('status lọc đúng một trạng thái', async () => {
      expect((await listOk('?status=CONTACTED')).items.map((item) => item.id)).toEqual([rowId(2)]);
      expect((await listOk('?status=NEW')).items.map((item) => item.id)).toEqual([
        rowId(1),
        rowId(6),
      ]);
    });

    it('search khớp name HOẶC email contains, không phân biệt hoa/thường', async () => {
      expect((await listOk('?search=grace')).items.map((item) => item.id)).toEqual([rowId(2)]);
      // Khớp qua EMAIL (cột citext, giá trị fixture viết hoa) chứ không qua name.
      expect((await listOk('?search=alan@')).items.map((item) => item.id)).toEqual([rowId(3)]);
      // Kết hợp với status là GIAO, không phải hợp.
      expect((await listOk('?search=lead&status=LOST')).items.map((item) => item.id)).toEqual([
        rowId(5),
      ]);
    });

    it('tourId lọc đúng lead gắn tour đó', async () => {
      expect((await listOk(`?tourId=${tour.id}`)).items.map((item) => item.id)).toEqual([
        rowId(1),
        rowId(2),
      ]);
    });

    it('notesCount đếm đúng thread của TỪNG hàng', async () => {
      await prisma.enquiryNote.createMany({
        data: [
          { enquiryId: rowId(2), authorId: adminId, authorName: ADMIN_NAME, body: 'first' },
          { enquiryId: rowId(2), authorId: adminId, authorName: ADMIN_NAME, body: 'second' },
        ],
      });
      const paged = await listOk('');
      const counts = new Map(paged.items.map((item) => [item.id, item.notesCount]));
      expect(counts.get(rowId(2))).toBe(2);
      expect(counts.get(rowId(1))).toBe(0);
    });

    it('phân trang: page/limit ép từ query string, totalPages đúng', async () => {
      const page2 = await listOk('?limit=2&page=2');
      expect(page2).toMatchObject({ page: 2, limit: 2, total: 6, totalPages: 3 });
      expect(page2.items.map((item) => item.id)).toEqual([rowId(3), rowId(4)]);
    });

    it('status ngoài enum / tourId không phải uuid → 400 (contract chặn trước DB)', async () => {
      expect((await list('?status=ARCHIVED', adminCookie)).statusCode).toBe(400);
      expect((await list('?tourId=not-a-uuid', adminCookie)).statusCode).toBe(400);
    });
  });

  describe('byId', () => {
    it('200: row đầy đủ + message nguyên văn + notes CŨ TRƯỚC + lịch sử trạng thái', async () => {
      await prisma.enquiryNote.createMany({
        data: [
          {
            enquiryId: rowId(1),
            authorId: adminId,
            authorName: ADMIN_NAME,
            body: 'Older note',
            createdAt: at(30),
          },
          {
            enquiryId: rowId(1),
            authorId: adminId,
            authorName: ADMIN_NAME,
            body: 'Newer note',
            createdAt: at(10),
          },
        ],
      });
      await prisma.enquiryStatusEvent.create({
        data: {
          enquiryId: rowId(1),
          adminId,
          fromStatus: EnquiryStatus.NEW,
          toStatus: EnquiryStatus.CONTACTED,
        },
      });

      const detail = await detailOk(rowId(1));
      expect(detail).toMatchObject({
        id: rowId(1),
        nationality: 'United Kingdom',
        interests: ['food', 'photography'],
        notesCount: 2,
      });
      expect(detail.message).toContain('Message body number 1');
      // Thread đọc như một cuộc trò chuyện: cũ trước.
      expect(detail.notes.map((note) => note.body)).toEqual(['Older note', 'Newer note']);
      expect(detail.notes[0]?.authorName).toBe(ADMIN_NAME);
      expect(detail.statusEvents).toEqual([
        expect.objectContaining({
          fromStatus: 'NEW',
          toStatus: 'CONTACTED',
          adminName: ADMIN_NAME,
        }),
      ]);
    });

    it('lead chưa ai sờ tới: hai danh sách rỗng, interests rỗng — không null', async () => {
      const detail = await detailOk(rowId(6));
      expect(detail.notes).toEqual([]);
      expect(detail.statusEvents).toEqual([]);
      expect(detail.interests).toEqual([]);
    });

    it('id không tồn tại → 404 NOT_FOUND; id không phải uuid → 400', async () => {
      const missing = await byId(MISSING_ID, adminCookie);
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect((await byId('lead-42', adminCookie)).statusCode).toBe(400);
    });
  });

  describe('setStatus', () => {
    it('đổi trạng thái + nối MỘT event audit đúng from/to/adminId, trong cùng transaction', async () => {
      const before = Date.now();
      const res = await setStatus(rowId(1), 'QUOTED', adminCookie);
      expect(res.statusCode).toBe(200);
      const detail = EnquiryDetailSchema.parse(res.json());
      expect(detail.status).toBe('QUOTED');

      const events = await prisma.enquiryStatusEvent.findMany({ where: { enquiryId: rowId(1) } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        fromStatus: EnquiryStatus.NEW,
        toStatus: EnquiryStatus.QUOTED,
        adminId,
      });
      expect(events[0]?.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      // Response mang luôn dòng vừa nối — trang chi tiết không phải chờ refresh.
      expect(detail.statusEvents).toEqual([
        expect.objectContaining({ fromStatus: 'NEW', toStatus: 'QUOTED', adminName: ADMIN_NAME }),
      ]);
    });

    it('chuyển TỰ DO: WON → NEW cũng được (không ép luồng), event ghi đúng chiều lùi', async () => {
      expect((await setStatus(rowId(4), 'NEW', adminCookie)).statusCode).toBe(200);
      const events = await prisma.enquiryStatusEvent.findMany({ where: { enquiryId: rowId(4) } });
      expect(events[0]).toMatchObject({
        fromStatus: EnquiryStatus.WON,
        toStatus: EnquiryStatus.NEW,
      });
    });

    it('CÙNG trạng thái → no-op có chủ đích: 200, KHÔNG event nào, updatedAt không đổi', async () => {
      const before = await prisma.enquiry.findUniqueOrThrow({ where: { id: rowId(2) } });
      const res = await setStatus(rowId(2), 'CONTACTED', adminCookie);
      expect(res.statusCode).toBe(200);
      expect(EnquiryDetailSchema.parse(res.json()).status).toBe('CONTACTED');
      expect(await prisma.enquiryStatusEvent.count({ where: { enquiryId: rowId(2) } })).toBe(0);
      const after = await prisma.enquiry.findUniqueOrThrow({ where: { id: rowId(2) } });
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });

    it('hai lần đổi liên tiếp → hai event, CŨ TRƯỚC trong response', async () => {
      await setStatus(rowId(1), 'CONTACTED', adminCookie);
      const res = await setStatus(rowId(1), 'WON', adminCookie);
      const detail = EnquiryDetailSchema.parse(res.json());
      expect(detail.statusEvents.map((event) => `${event.fromStatus}→${event.toStatus}`)).toEqual([
        'NEW→CONTACTED',
        'CONTACTED→WON',
      ]);
    });

    it('id không tồn tại → 404 NOT_FOUND; status ngoài enum → 400', async () => {
      const missing = await setStatus(MISSING_ID, 'WON', adminCookie);
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect((await setStatus(rowId(1), 'ARCHIVED', adminCookie)).statusCode).toBe(400);
      expect(await prisma.enquiryStatusEvent.count()).toBe(0);
    });
  });

  describe('addNote', () => {
    it('nối note với authorId/authorName lấy từ PHIÊN, không phải từ input', async () => {
      const res = await addNote(rowId(1), '  Called the lead, sending a quote.  ', adminCookie);
      expect(res.statusCode).toBe(200);
      const detail = EnquiryDetailSchema.parse(res.json());
      expect(detail.notes).toHaveLength(1);
      expect(detail.notes[0]).toMatchObject({
        authorName: ADMIN_NAME,
        // Contract trim TRƯỚC min(1) — row lưu đúng phần có chữ.
        body: 'Called the lead, sending a quote.',
      });
      expect(detail.notesCount).toBe(1);
      const stored = await prisma.enquiryNote.findFirstOrThrow({ where: { enquiryId: rowId(1) } });
      expect(stored.authorId).toBe(adminId);
    });

    it('thread APPEND-ONLY: note thứ hai nối XUỐNG DƯỚI, note đầu còn nguyên', async () => {
      await addNote(rowId(1), 'first', adminCookie);
      const res = await addNote(rowId(1), 'second', adminCookie);
      const detail = EnquiryDetailSchema.parse(res.json());
      expect(detail.notes.map((note) => note.body)).toEqual(['first', 'second']);
    });

    it('body rỗng / chỉ dấu cách / quá 2000 ký tự → 400, không ghi row nào', async () => {
      expect((await addNote(rowId(1), '', adminCookie)).statusCode).toBe(400);
      expect((await addNote(rowId(1), '   ', adminCookie)).statusCode).toBe(400);
      expect((await addNote(rowId(1), 'x'.repeat(2001), adminCookie)).statusCode).toBe(400);
      expect(await prisma.enquiryNote.count()).toBe(0);
      // Đúng trần thì vẫn ăn — 2000 là biên HỢP LỆ, không phải biên bị chặn.
      expect((await addNote(rowId(1), 'x'.repeat(2000), adminCookie)).statusCode).toBe(200);
    });

    it('id không tồn tại → 404 NOT_FOUND (không tạo note mồ côi)', async () => {
      const missing = await addNote(MISSING_ID, 'hello', adminCookie);
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect(await prisma.enquiryNote.count()).toBe(0);
    });
  });
});
