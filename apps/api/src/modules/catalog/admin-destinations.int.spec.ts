import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AdminDestinationRowSchema } from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';

/**
 * Integration (Docker PG, db `tourism_test`) — bốn thao tác quản trị điểm đến
 * (spec P4e-2 F15).
 *
 * Ba ca đắt nhất ở đây:
 *
 *  ① `setActive` KHÔNG đụng liên kết `tour_destinations` — đếm trước và sau
 *    bằng nhau. Đó là chốt của quyết định "chỉ ẩn, không xoá" (spec §2a):
 *    khoá ngoại khai `ON DELETE CASCADE`, nên một lệnh xoá sẽ âm thầm gỡ điểm
 *    đến khỏi mọi tour; ẩn thì không được phép làm thế.
 *  ② slug trùng ra 409 chứ không phải 500 của `P2002` — kể cả khi HAI lượt tạo
 *    bắn cùng lúc. Bài học 1 của vòng review F14: bắt `P2002` ngay ở lệnh ghi,
 *    không SELECT kiểm trước (READ COMMITTED không serialize hai INSERT).
 *  ③ bust cache đi SAU lệnh ghi — cờ theo dõi đọc DB ngay lúc bust được gọi và
 *    phải thấy trạng thái MỚI.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const CUSTOMER_EMAIL = 'dest-customer@example.com';

const destId = (n: number) => `d1500001-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CATEGORY_ID = 'c1500001-0000-4000-8000-000000000001';

/** Ba điểm đến dựng sẵn — một đang ẩn, để thấy `list` của admin trả cả nó. */
const SEED = [
  { id: destId(1), slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam', isActive: true },
  { id: destId(2), slug: 'hanoi', name: 'Hà Nội', region: 'Northern Vietnam', isActive: true },
  // Tên sắp TRƯỚC hai hàng kia, slug thì sắp SAU — để ca "sắp theo tên" phân biệt
  // được với một bản lỡ tay sắp theo slug.
  { id: destId(3), slug: 'retired', name: 'An Bàng', region: 'Southern Vietnam', isActive: false },
] satisfies Prisma.DestinationCreateManyInput[];

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

describe('admin destinations integration (P4e-2 F15)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let web: WebRevalidationService;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE destinations, tour_categories, users CASCADE');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    web = moduleRef.get(WebRevalidationService);

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
    vi.restoreAllMocks();
    // Tour trỏ vào danh mục bằng FK RESTRICT — xoá tour TRƯỚC; liên kết
    // `tour_destinations` đi theo tour (CASCADE).
    await prisma.tour.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.tourCategory.create({
      data: { id: CATEGORY_ID, slug: 'day-trips', name: 'Day trips', order: 1 },
    });
    await prisma.destination.createMany({ data: SEED });
  });

  afterAll(async () => {
    await app?.close();
  });

  const list = (cookie: string) =>
    app.inject({ method: 'GET', url: '/api/admin/destinations', headers: { cookie } });

  const create = (payload: Record<string, unknown>, cookie: string) =>
    app.inject({ method: 'POST', url: '/api/admin/destinations', headers: { cookie }, payload });

  const update = (id: string, payload: Record<string, unknown>, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/destinations/${id}`,
      headers: { cookie },
      payload,
    });

  const setActive = (id: string, isActive: boolean, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/destinations/${id}/active`,
      headers: { cookie },
      payload: { isActive },
    });

  const listOk = async () => {
    const res = await list(adminCookie);
    expect(res.statusCode).toBe(200);
    return AdminDestinationRowSchema.array().parse(res.json());
  };

  /** Một tour gắn vào các điểm đến cho sẵn — điểm đầu là điểm chính. */
  async function tourVisiting(slug: string, destinationIds: string[], isPublished = true) {
    return prisma.tour.create({
      data: {
        slug,
        title: slug,
        categoryId: CATEGORY_ID,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished,
        destinations: {
          create: destinationIds.map((destinationId, i) => ({ destinationId, isPrimary: i === 0 })),
        },
      } as unknown as Prisma.TourCreateInput,
    });
  }

  const UPDATE = {
    name: 'Hội An',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: null,
  };

  describe('guard', () => {
    it('khách thường không chạm được endpoint nào — đủ bốn đường', async () => {
      // Bài học 5 của vòng review F14: khối guard từng bỏ sót `update`. Đếm
      // đủ bốn trên bốn.
      expect((await list(customerCookie)).statusCode).toBe(403);
      expect(
        (await create({ name: 'X', slug: 'x', region: 'Central Vietnam' }, customerCookie))
          .statusCode,
      ).toBe(403);
      expect((await update(destId(1), UPDATE, customerCookie)).statusCode).toBe(403);
      expect((await setActive(destId(1), false, customerCookie)).statusCode).toBe(403);
    });

    it('chưa đăng nhập thì cả bốn đường đều 401', async () => {
      const anon = '';
      expect((await list(anon)).statusCode).toBe(401);
      expect(
        (await create({ name: 'X', slug: 'x', region: 'Central Vietnam' }, anon)).statusCode,
      ).toBe(401);
      expect((await update(destId(1), UPDATE, anon)).statusCode).toBe(401);
      expect((await setActive(destId(1), false, anon)).statusCode).toBe(401);
    });
  });

  describe('list', () => {
    it('trả CẢ hàng đã ẩn, sắp theo tên', async () => {
      const rows = await listOk();

      expect(rows.map((row) => row.slug)).toEqual(['retired', 'hanoi', 'hoi-an']);
      expect(rows.find((row) => row.slug === 'retired')?.isActive).toBe(false);
    });

    it('endpoint CÔNG KHAI thì không — đó là khác biệt giữa hai bề mặt', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/destinations' });

      expect(res.statusCode).toBe(200);
      const slugs = (res.json() as { slug: string }[]).map((row) => row.slug);
      expect(slugs).not.toContain('retired');
    });

    it('`tourCount` đếm tour ĐÃ ĐĂNG gắn vào điểm đến, không đếm nháp', async () => {
      // Con số này nuôi câu cảnh báo lúc ẩn — nó phải đếm đúng thứ khách đang
      // nhìn thấy.
      await tourVisiting('published-one', [destId(1), destId(2)]);
      await tourVisiting('draft-one', [destId(1)], false);

      const rows = await listOk();

      expect(rows.find((row) => row.slug === 'hoi-an')?.tourCount).toBe(1);
      expect(rows.find((row) => row.slug === 'hanoi')?.tourCount).toBe(1);
      expect(rows.find((row) => row.slug === 'retired')?.tourCount).toBe(0);
    });

    it('`region` trả nguyên giá trị THÔ trong DB, kể cả dạng kiểu cũ', async () => {
      // Output không chặt: một hàng kiểu cũ mà làm cả bảng sập 500 thì admin
      // mất đúng màn cần để sửa nó.
      await prisma.destination.update({ where: { id: destId(2) }, data: { region: 'north' } });

      const rows = await listOk();

      expect(rows.find((row) => row.slug === 'hanoi')?.region).toBe('north');
    });
  });

  describe('create', () => {
    it('tạo được, `country` mặc định Vietnam, mô tả bỏ trống là `null`', async () => {
      const res = await create(
        { name: 'Phú Quốc', slug: 'phu-quoc', region: 'Southern Vietnam' },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const row = AdminDestinationRowSchema.parse(res.json());
      expect(row).toMatchObject({
        slug: 'phu-quoc',
        name: 'Phú Quốc',
        country: 'Vietnam',
        region: 'Southern Vietnam',
        description: null,
        isActive: true,
        tourCount: 0,
      });
      expect((await listOk()).map((r) => r.slug)).toContain('phu-quoc');
    });

    it('slug TRÙNG → 409 SLUG_TAKEN, không phải 500 của P2002', async () => {
      const res = await create(
        { name: 'Another', slug: 'hoi-an', region: 'Central Vietnam' },
        adminCookie,
      );

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('SLUG_TAKEN');
      expect(await prisma.destination.count()).toBe(3);
    });

    it('trùng với một điểm đến ĐÃ ẨN cũng là trùng', async () => {
      const res = await create(
        { name: 'X', slug: 'retired', region: 'Southern Vietnam' },
        adminCookie,
      );

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('SLUG_TAKEN');
    });

    it('hai lượt tạo CÙNG SLUG bắn cùng lúc: một 200, một 409 — không lượt nào 500', async () => {
      // Không có SELECT kiểm trước để mà đua: lệnh INSERT tự đụng chỉ mục
      // `@unique`, và `P2002` đổi thành `SLUG_TAKEN` ngay tại chỗ.
      const results = await Promise.all([
        create({ name: 'Phú Quốc A', slug: 'phu-quoc', region: 'Southern Vietnam' }, adminCookie),
        create({ name: 'Phú Quốc B', slug: 'phu-quoc', region: 'Southern Vietnam' }, adminCookie),
      ]);
      const codes = results.map((res) => res.statusCode).sort();

      expect(codes).toEqual([200, 409]);
      expect(results.find((res) => res.statusCode === 409)?.json().code).toBe('SLUG_TAKEN');
      expect(await prisma.destination.count({ where: { slug: 'phu-quoc' } })).toBe(1);
    });

    it('vùng lạ bị chặn ở cổng input — không bao giờ xuống tới cột chữ tự do', async () => {
      const res = await create({ name: 'X', slug: 'x', region: 'Mekong' }, adminCookie);

      expect(res.statusCode).toBe(400);
      expect(await prisma.destination.count({ where: { slug: 'x' } })).toBe(0);
    });
  });

  describe('update', () => {
    it('đổi được tên, quốc gia, vùng và mô tả — KHÔNG đụng slug', async () => {
      const res = await update(
        destId(1),
        {
          name: 'Hoi An Ancient Town',
          country: 'Viet Nam',
          region: 'Southern Vietnam',
          description: 'Lanterns.',
        },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      expect(AdminDestinationRowSchema.parse(res.json())).toMatchObject({
        slug: 'hoi-an',
        name: 'Hoi An Ancient Town',
        country: 'Viet Nam',
        region: 'Southern Vietnam',
        description: 'Lanterns.',
      });
    });

    it('gửi kèm slug cũng không đổi được — contract đã bỏ khoá ấy', async () => {
      // Lệnh sửa phải CHẠY THẬT (200) thì "slug không đổi" mới có nghĩa: một
      // route chưa tồn tại cũng để slug nguyên vẹn (đo lúc chạy đỏ).
      const res = await update(
        destId(1),
        { ...UPDATE, name: 'Hội An mới', slug: 'hacked' },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const row = await prisma.destination.findUnique({ where: { id: destId(1) } });
      expect(row?.name).toBe('Hội An mới');
      expect(row?.slug).toBe('hoi-an');
    });

    it('trả `tourCount` của chính câu ghi', async () => {
      await tourVisiting('published-one', [destId(1)]);

      const res = await update(destId(1), UPDATE, adminCookie);

      expect(AdminDestinationRowSchema.parse(res.json()).tourCount).toBe(1);
    });

    it('id lạ → 404 NOT_FOUND với câu của contract, không lộ câu mang id', async () => {
      // Khớp CÂU chứ không riêng mã: một route chưa tồn tại cũng trả 404 kèm
      // `NOT_FOUND` (đo lúc chạy đỏ), nên chỉ câu của contract mới chứng minh
      // lệnh đã chạy tới service rồi mới hỏng.
      const res = await update(destId(999), UPDATE, adminCookie);

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Destination not found' });
    });
  });

  describe('setActive', () => {
    it('ẩn rồi hiện lại — liên kết `tour_destinations` đếm trước và sau BẰNG NHAU', async () => {
      await tourVisiting('published-one', [destId(1), destId(2)]);
      await tourVisiting('draft-one', [destId(1)], false);
      const linksBefore = await prisma.tourDestination.count({
        where: { destinationId: destId(1) },
      });

      const hidden = await setActive(destId(1), false, adminCookie);

      expect(hidden.statusCode).toBe(200);
      expect(AdminDestinationRowSchema.parse(hidden.json()).isActive).toBe(false);
      // Chốt của "chỉ ẩn, không xoá" (spec §2a): tour vẫn gắn điểm đến ấy.
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(1) } })).toBe(
        linksBefore,
      );
      expect(linksBefore).toBe(2);

      const shown = await setActive(destId(1), true, adminCookie);

      expect(AdminDestinationRowSchema.parse(shown.json())).toMatchObject({
        isActive: true,
        tourCount: 1,
      });
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(1) } })).toBe(
        linksBefore,
      );
    });

    it('điểm đến đã ẩn biến khỏi endpoint công khai, tour của nó vẫn lọc được theo slug', async () => {
      // Đây là điều câu cảnh báo ở màn admin phải nói đúng: link cũ
      // `/tours?destinations=hoi-an` vẫn chạy.
      await tourVisiting('published-one', [destId(1)]);
      await setActive(destId(1), false, adminCookie);

      const publicList = await app.inject({ method: 'GET', url: '/api/destinations' });
      const tours = await app.inject({ method: 'GET', url: '/api/tours?destination=hoi-an' });

      expect((publicList.json() as { slug: string }[]).map((d) => d.slug)).not.toContain('hoi-an');
      expect(tours.statusCode).toBe(200);
      expect((tours.json() as { items: { slug: string }[] }).items.map((t) => t.slug)).toEqual([
        'published-one',
      ]);
    });

    it('id lạ → 404 NOT_FOUND với câu của contract', async () => {
      const res = await setActive(destId(999), false, adminCookie);

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Destination not found' });
    });
  });

  describe('bust cache web', () => {
    it('gọi tag `tours` SAU khi lệnh ghi đã ăn — lúc bust, DB đã mang giá trị mới', async () => {
      // ADR-0016 §3: bust trước khi ghi xong là web regenerate đọc dữ liệu cũ
      // rồi giữ nó 300 giây. Cờ theo dõi đọc DB ngay trong lúc được gọi.
      const seen: Array<{ tags: string[]; isActive: boolean | undefined }> = [];
      vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        const row = await prisma.destination.findUnique({ where: { id: destId(1) } });
        seen.push({ tags, isActive: row?.isActive });
      });

      await setActive(destId(1), false, adminCookie);

      await vi.waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toEqual({ tags: ['tours'], isActive: false });
    });

    it('bust đủ ba lệnh ghi, và KHÔNG bust khi lệnh ghi hỏng', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await create({ name: 'Phú Quốc', slug: 'phu-quoc', region: 'Southern Vietnam' }, adminCookie);
      await update(destId(1), UPDATE, adminCookie);
      await setActive(destId(1), true, adminCookie);
      expect(revalidate).toHaveBeenCalledTimes(3);
      for (const call of revalidate.mock.calls) expect(call[0]).toEqual(['tours']);

      revalidate.mockClear();
      await create({ name: 'Dup', slug: 'hoi-an', region: 'Central Vietnam' }, adminCookie);
      await update(destId(999), UPDATE, adminCookie);
      await setActive(destId(999), false, adminCookie);
      expect(revalidate).not.toHaveBeenCalled();
    });
  });
});
