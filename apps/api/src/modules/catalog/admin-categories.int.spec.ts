import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AdminCategoryRowSchema } from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Integration (Docker PG, db `tourism_test`) — năm thao tác quản trị danh mục
 * tour (spec P4e-2 F14).
 *
 * Ba ca đắt nhất ở đây:
 *
 *  ① `list` của admin trả CẢ hàng đã tắt, còn endpoint công khai thì không —
 *    đó là toàn bộ khác biệt giữa hai bề mặt;
 *  ② slug trùng ra 409 chứ không phải 500 của `P2002` (bài học F12: 500 làm
 *    kit đóng dialog và admin mất cả form vừa gõ);
 *  ③ `move` đổi chỗ đúng hai hàng, từ chối ở biên, và hai lượt đối đầu không
 *    sinh `order` trùng.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const CUSTOMER_EMAIL = 'cat-customer@example.com';

/** Bốn danh mục dựng sẵn, `order` 1..4 — vừa đủ để thử đổi chỗ ở giữa và ở biên. */
const catId = (n: number) => `c1400001-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SEED = [
  { id: catId(1), slug: 'day-trips', name: 'Day trips', order: 1, isActive: true },
  { id: catId(2), slug: 'packages', name: 'Packages', order: 2, isActive: true },
  { id: catId(3), slug: 'cruises', name: 'Cruises', order: 3, isActive: true },
  { id: catId(4), slug: 'retired', name: 'Retired', order: 4, isActive: false },
] satisfies Prisma.TourCategoryCreateManyInput[];

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

describe('admin categories integration (P4e-2 F14)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE tour_categories, users CASCADE');

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
    // Tour trỏ vào danh mục bằng FK RESTRICT — xoá tour TRƯỚC.
    await prisma.tour.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.tourCategory.createMany({ data: SEED });
  });

  afterAll(async () => {
    await app?.close();
  });

  const list = (cookie: string) =>
    app.inject({ method: 'GET', url: '/api/admin/categories', headers: { cookie } });

  const create = (payload: Record<string, unknown>, cookie: string) =>
    app.inject({ method: 'POST', url: '/api/admin/categories', headers: { cookie }, payload });

  const update = (id: string, payload: Record<string, unknown>, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/categories/${id}`,
      headers: { cookie },
      payload,
    });

  const setActive = (id: string, isActive: boolean, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/categories/${id}/active`,
      headers: { cookie },
      payload: { isActive },
    });

  const move = (id: string, direction: 'up' | 'down', cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/categories/${id}/move`,
      headers: { cookie },
      payload: { direction },
    });

  const listOk = async () => {
    const res = await list(adminCookie);
    expect(res.statusCode).toBe(200);
    return AdminCategoryRowSchema.array().parse(res.json());
  };

  const slugsInOrder = async () => (await listOk()).map((row) => row.slug);

  describe('guard', () => {
    it('khách thường không chạm được endpoint nào', async () => {
      expect((await list(customerCookie)).statusCode).toBe(403);
      expect((await create({ name: 'X', slug: 'x' }, customerCookie)).statusCode).toBe(403);
      expect((await setActive(catId(1), false, customerCookie)).statusCode).toBe(403);
      expect((await move(catId(1), 'down', customerCookie)).statusCode).toBe(403);
    });
  });

  describe('list', () => {
    it('trả CẢ hàng đã tắt, sắp theo `order`', async () => {
      const rows = await listOk();

      expect(rows.map((row) => row.slug)).toEqual(['day-trips', 'packages', 'cruises', 'retired']);
      expect(rows.find((row) => row.slug === 'retired')?.isActive).toBe(false);
    });

    it('endpoint CÔNG KHAI thì không — đó là khác biệt duy nhất giữa hai bề mặt', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/categories' });

      expect(res.statusCode).toBe(200);
      const slugs = (res.json() as { slug: string }[]).map((row) => row.slug);
      expect(slugs).not.toContain('retired');
    });

    it('`tourCount` đếm tour ĐÃ ĐĂNG, không đếm nháp', async () => {
      // Con số này nuôi câu cảnh báo lúc tắt danh mục, nên nó phải đếm đúng thứ
      // khách đang nhìn thấy — tour nháp thì không ai thấy.
      await prisma.tour.createMany({
        data: [
          {
            slug: 'published-one',
            title: 'Published one',
            categoryId: catId(1),
            durationDays: 1,
            basePrice: '39.00',
            currency: 'USD',
            isPublished: true,
          },
          {
            slug: 'draft-one',
            title: 'Draft one',
            categoryId: catId(1),
            durationDays: 1,
            basePrice: '39.00',
            currency: 'USD',
            isPublished: false,
          },
        ] as unknown as Prisma.TourCreateManyInput[],
      });

      const rows = await listOk();

      expect(rows.find((row) => row.slug === 'day-trips')?.tourCount).toBe(1);
      expect(rows.find((row) => row.slug === 'packages')?.tourCount).toBe(0);
    });
  });

  describe('create', () => {
    it('thêm vào CUỐI danh sách — `order` = max + 1', async () => {
      const res = await create({ name: 'Trekking', slug: 'trekking' }, adminCookie);

      expect(res.statusCode).toBe(200);
      expect(AdminCategoryRowSchema.parse(res.json()).order).toBe(5);
      expect(await slugsInOrder()).toEqual([
        'day-trips',
        'packages',
        'cruises',
        'retired',
        'trekking',
      ]);
    });

    it('slug TRÙNG → 409 SLUG_TAKEN, không phải 500 của P2002', async () => {
      // 500 trần thì admin phân loại `GENERIC`, mà `GENERIC` nằm trong nhóm
      // "kết cục KHÔNG RÕ" — kit ĐÓNG dialog và người ta mất cả form vừa gõ.
      const res = await create({ name: 'Another', slug: 'day-trips' }, adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('SLUG_TAKEN');
      expect((await listOk()).length).toBe(4);
    });

    it('trùng với một danh mục ĐÃ TẮT cũng là trùng', async () => {
      // Slug `@unique` không quan tâm hàng đang bật hay tắt, và nếu ta bỏ sót
      // thì lệnh ghi rơi xuống P2002 đúng như ca trên.
      expect((await create({ name: 'X', slug: 'retired' }, adminCookie)).statusCode).toBe(409);
    });

    it('mô tả bỏ trống vào DB là `null`, không phải chuỗi rỗng', async () => {
      const res = await create({ name: 'Trekking', slug: 'trekking' }, adminCookie);

      expect(AdminCategoryRowSchema.parse(res.json()).description).toBeNull();
    });
  });

  describe('update', () => {
    it('đổi tên và mô tả, KHÔNG đụng slug', async () => {
      const res = await update(
        catId(1),
        { name: 'Day tours', description: 'Back by dinner.' },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const row = AdminCategoryRowSchema.parse(res.json());
      expect(row.name).toBe('Day tours');
      expect(row.description).toBe('Back by dinner.');
      expect(row.slug).toBe('day-trips');
    });

    it('gửi kèm slug cũng không đổi được — contract đã bỏ khoá ấy', async () => {
      await update(catId(1), { name: 'X', description: null, slug: 'hacked' }, adminCookie);

      expect((await slugsInOrder())[0]).toBe('day-trips');
    });

    it('id lạ → 404', async () => {
      const res = await update(
        'c1400001-0000-4000-8000-999999999999',
        { name: 'X', description: null },
        adminCookie,
      );

      expect(res.statusCode).toBe(404);
    });
  });

  describe('setActive', () => {
    it('tắt rồi bật lại, không đụng tour nào', async () => {
      await prisma.tour.create({
        data: {
          slug: 'in-day-trips',
          title: 'In day trips',
          categoryId: catId(1),
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: true,
        } as unknown as Prisma.TourCreateInput,
      });

      expect((await setActive(catId(1), false, adminCookie)).statusCode).toBe(200);
      expect((await listOk()).find((row) => row.slug === 'day-trips')?.isActive).toBe(false);
      // Tour vẫn còn và vẫn thuộc danh mục ấy — đây là điều câu cảnh báo ở màn
      // admin phải nói đúng.
      expect(await prisma.tour.count({ where: { categoryId: catId(1) } })).toBe(1);

      expect((await setActive(catId(1), true, adminCookie)).statusCode).toBe(200);
      expect((await listOk()).find((row) => row.slug === 'day-trips')?.tourCount).toBe(1);
    });

    it('id lạ → 404', async () => {
      const res = await setActive('c1400001-0000-4000-8000-999999999999', false, adminCookie);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('move', () => {
    it('xuống một bậc: đổi chỗ với hàng ngay sau', async () => {
      const res = await move(catId(1), 'down', adminCookie);

      expect(res.statusCode).toBe(200);
      expect(await slugsInOrder()).toEqual(['packages', 'day-trips', 'cruises', 'retired']);
    });

    it('lên một bậc: đổi chỗ với hàng ngay trước', async () => {
      await move(catId(3), 'up', adminCookie);

      expect(await slugsInOrder()).toEqual(['day-trips', 'cruises', 'packages', 'retired']);
    });

    it('hàng ĐẦU bấm lên → 409 CANNOT_MOVE, thứ tự không đổi', async () => {
      const res = await move(catId(1), 'up', adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CANNOT_MOVE');
      expect(await slugsInOrder()).toEqual(['day-trips', 'packages', 'cruises', 'retired']);
    });

    it('hàng CUỐI bấm xuống → 409 CANNOT_MOVE', async () => {
      const res = await move(catId(4), 'down', adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CANNOT_MOVE');
    });

    it('hàng đã TẮT vẫn sắp được — thứ tự là thuộc tính của hàng, không phải của trạng thái', async () => {
      await move(catId(4), 'up', adminCookie);

      expect(await slugsInOrder()).toEqual(['day-trips', 'packages', 'retired', 'cruises']);
    });

    it('HAI lượt đối đầu không sinh `order` trùng', async () => {
      // Hai admin bấm cùng lúc: một người đẩy hàng 2 xuống, người kia đẩy hàng
      // 3 lên — cả hai cùng nhắm vào một cặp. Khoá hai hàng theo thứ tự id cố
      // định là thứ giữ cho không có hai hàng nào cùng số.
      await Promise.all([move(catId(2), 'down', adminCookie), move(catId(3), 'up', adminCookie)]);

      const orders = (await listOk()).map((row) => row.order);
      expect(new Set(orders).size).toBe(orders.length);
    });

    it('trả về CẢ danh sách đã sắp lại, không phải một hàng', async () => {
      // Đổi chỗ động tới hai hàng, nên trả một hàng là bắt client tự đoán hàng
      // kia — hoặc tự gọi `list` thêm một lượt.
      const res = await move(catId(1), 'down', adminCookie);

      expect(AdminCategoryRowSchema.array().parse(res.json())).toHaveLength(4);
    });
  });
});
