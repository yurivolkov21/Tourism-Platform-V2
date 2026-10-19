import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminDestinationPhotosSchema,
  AdminDestinationRowSchema,
  SignedUploadParamsSchema,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { trackOpenTransactions } from '../../test/open-transactions.js';
import { sessionCookie } from '../../test/session-cookie.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import { countLinkedTours } from './destination-tour-links.js';

/**
 * Integration (Docker PG, db `tourism_test`) — năm thao tác quản trị điểm đến
 * (spec P4e-2 F15, lệnh xoá theo ADR-0053).
 *
 * Ba ca đắt nhất ở đây:
 *
 *  ① `setActive` KHÔNG đụng liên kết `tour_destinations` — đếm trước và sau
 *    bằng nhau. Điểm đến còn tour thì ẩn là đường duy nhất (spec §2a,
 *    ADR-0053): lệnh xoá trả `IN_USE`, và từ AMEND 2 (G25) khoá ngoại
 *    `RESTRICT` chặn mọi đường xoá khác; ẩn thì không được gỡ liên kết nào.
 *  ② slug trùng ra 409 chứ không phải 500 của `P2002` — kể cả khi HAI lượt tạo
 *    bắn cùng lúc. Bài học 1 của vòng review F14: bắt `P2002` ngay ở lệnh ghi,
 *    không SELECT kiểm trước (READ COMMITTED không serialize hai INSERT).
 *  ③ bust cache đi SAU lệnh ghi — cờ theo dõi đọc DB ngay lúc bust được gọi và
 *    phải thấy trạng thái MỚI.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const CUSTOMER_EMAIL = 'dest-customer@example.com';
const STAFF_EMAIL = 'dest-staff@tourism.test';

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

describe('admin destinations integration (P4e-2 F15)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let staffCookie: string;
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

    const roles = { [ADMIN_EMAIL]: 'ADMIN', [STAFF_EMAIL]: 'STAFF' } as const;
    for (const email of [ADMIN_EMAIL, STAFF_EMAIL, CUSTOMER_EMAIL]) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name: 'Test User' },
      });
      await prisma.user.update({
        where: { email },
        data: {
          emailVerified: true,
          ...(email in roles ? { role: roles[email as keyof typeof roles] } : {}),
        },
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
    staffCookie = sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: STAFF_EMAIL, password: PASSWORD },
      }),
    );
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // media_assets là bảng đa chủ, không khoá ngoại (ADR-0048) — dọn để ca này không nhặt
    // dòng ảnh của ca trước.
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaGarbage.deleteMany();
    // Tour trỏ vào danh mục bằng FK RESTRICT — xoá tour TRƯỚC; liên kết
    // `tour_destinations` đi theo tour (CASCADE). Liên kết mồ côi của ca đếm (review EF2)
    // trỏ một tour đã xoá nên không đi theo tour nào, mà khoá ngoại phía điểm đến là
    // RESTRICT (ADR-0053 AMEND 2) — xoá liên kết tường minh TRƯỚC điểm đến.
    await prisma.tour.deleteMany();
    await prisma.tourDestination.deleteMany();
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

  const remove = (id: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/destinations/${id}/delete`,
      headers: { cookie },
      payload: {},
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
    it('khách thường không chạm được endpoint nào — đủ năm đường', async () => {
      // Bài học 5 của vòng review F14: khối guard từng bỏ sót `update`. Đếm
      // đủ năm trên năm.
      expect((await list(customerCookie)).statusCode).toBe(403);
      expect(
        (await create({ name: 'X', slug: 'x', region: 'Central Vietnam' }, customerCookie))
          .statusCode,
      ).toBe(403);
      expect((await update(destId(1), UPDATE, customerCookie)).statusCode).toBe(403);
      expect((await setActive(destId(1), false, customerCookie)).statusCode).toBe(403);
      expect((await remove(destId(1), customerCookie)).statusCode).toBe(403);
    });

    it('chưa đăng nhập thì cả năm đường đều 401', async () => {
      const anon = '';
      expect((await list(anon)).statusCode).toBe(401);
      expect(
        (await create({ name: 'X', slug: 'x', region: 'Central Vietnam' }, anon)).statusCode,
      ).toBe(401);
      expect((await update(destId(1), UPDATE, anon)).statusCode).toBe(401);
      expect((await setActive(destId(1), false, anon)).statusCode).toBe(401);
      expect((await remove(destId(1), anon)).statusCode).toBe(401);
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
      // ADR-0053 §5: tour nháp vẫn chặn xoá.
      expect(rows.find((row) => row.slug === 'hoi-an')?.linkedTourCount).toBe(2);
      expect(rows.find((row) => row.slug === 'retired')?.linkedTourCount).toBe(0);
    });

    it('đếm bằng MỘT câu SQL ra đúng như cách cũ — tour nháp, tour đã đăng, tour vừa xoá, liên kết mồ côi (review EF2)', async () => {
      // `list` đếm tour bằng một câu GROUP BY JOIN `tours` thay cho đọc liên kết rồi tour qua hai
      // câu nối đuôi. Ca này so hai cách trên cùng dữ liệu, kể cả hình AL6: một liên kết trỏ tour
      // KHÔNG còn — cách cũ thấy `tour: null` rồi bỏ, câu mới phải bỏ bằng JOIN (đếm thẳng
      // `tour_destinations` thì đếm nhầm nó).
      await tourVisiting('published-one', [destId(1), destId(2)]);
      await tourVisiting('draft-one', [destId(1)], false);
      const gone = await tourVisiting('gone', [destId(1), destId(3)]);
      await prisma.tour.delete({ where: { id: gone.id } });
      // Khoá ngoại không cho dựng liên kết mồ côi ở trạng thái đã commit, nên tắt trigger khoá
      // ngoại trong ĐÚNG một transaction (`SET LOCAL`; user Postgres của docker và CI là
      // superuser). `beforeEach` dọn nó bằng câu xoá liên kết tường minh.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
        await tx.$executeRaw`
          INSERT INTO tour_destinations (tour_id, destination_id, is_primary)
          VALUES (${gone.id}::uuid, ${destId(2)}::uuid, false)
        `;
      });

      const legacy = await prisma.destination.findMany({
        select: { id: true, tours: { select: { tour: { select: { isPublished: true } } } } },
      });
      const expected = Object.fromEntries(
        legacy.map((row) => [row.id, countLinkedTours(row.tours)]),
      );
      const counted = Object.fromEntries(
        (await listOk()).map((row) => [
          row.id,
          { tourCount: row.tourCount, linkedTourCount: row.linkedTourCount },
        ]),
      );

      expect(counted).toEqual(expected);
      // Số cụ thể — để hai cách cùng sai một kiểu cũng không xanh.
      expect(counted).toEqual({
        [destId(1)]: { tourCount: 1, linkedTourCount: 2 },
        [destId(2)]: { tourCount: 1, linkedTourCount: 1 },
        [destId(3)]: { tourCount: 0, linkedTourCount: 0 },
      });
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(2) } })).toBe(2);
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

    it('trả `tourCount` đếm tour ĐÃ ĐĂNG và `linkedTourCount` đếm MỌI tour (review SI3)', async () => {
      // Ca này không chứng minh được "đếm trong CÙNG câu với lệnh ghi" (bài học
      // 3 của F14) — muốn thế phải chen một lượt đăng tour vào giữa hai câu, và
      // cửa sổ ấy không dựng tất định được. Luật ấy do `DESTINATION_WRITE_SELECT`
      // giữ; ca này ghim cái thước đếm của đường ghi — trước review SI3 không ca nào
      // khoá `linkedTourCount` ở đây.
      await tourVisiting('published-one', [destId(1)]);
      await tourVisiting('draft-one', [destId(1)], false);

      const res = await update(destId(1), UPDATE, adminCookie);

      expect(AdminDestinationRowSchema.parse(res.json())).toMatchObject({
        tourCount: 1,
        linkedTourCount: 2,
      });
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
      // Hai con số tour của đường ghi (review SI3): tour nháp tính vào `linkedTourCount`.
      expect(AdminDestinationRowSchema.parse(hidden.json())).toMatchObject({
        isActive: false,
        tourCount: 1,
        linkedTourCount: 2,
      });
      // Chốt của đường ẩn (spec §2a, ADR-0053): tour vẫn gắn điểm đến ấy.
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(1) } })).toBe(
        linksBefore,
      );
      expect(linksBefore).toBe(2);

      const shown = await setActive(destId(1), true, adminCookie);

      expect(AdminDestinationRowSchema.parse(shown.json())).toMatchObject({
        isActive: true,
        tourCount: 1,
        linkedTourCount: 2,
      });
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(1) } })).toBe(
        linksBefore,
      );
    });

    it('điểm đến đã ẩn biến khỏi endpoint công khai, tour của nó vẫn lọc được theo slug', async () => {
      // Đây là điều câu cảnh báo ở màn admin phải nói đúng: link cũ
      // `/tours?destinations=hoi-an` vẫn chạy.
      // Tour thứ hai KHÔNG gắn điểm đến ấy: có nó thì "lọc đúng" mới khác được
      // "bỏ qua bộ lọc" — với một tour trong bảng, hai ca ra cùng một kết quả
      // (vòng review F15).
      await tourVisiting('published-one', [destId(1)]);
      await tourVisiting('published-two', [destId(2)]);
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

  describe('delete (ADR-0053)', () => {
    const PUBLIC_ID = 'tourism/destinations/hoi-an/lanterns';

    it('0 tour → xoá hàng và dòng ảnh thư viện của nó; ảnh điểm đến khác và ảnh tour mượn còn', async () => {
      const borrower = await tourVisiting('borrower', [destId(2)]);
      await prisma.mediaAsset.createMany({
        data: [
          {
            ownerType: 'DESTINATION',
            ownerId: destId(1),
            publicId: PUBLIC_ID,
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 1,
          },
          {
            ownerType: 'TOUR',
            ownerId: borrower.id,
            publicId: PUBLIC_ID,
            type: 'IMAGE',
            role: 'hero',
            sortOrder: 0,
          },
          // Ảnh thư viện của một điểm đến KHÁC — chốt duy nhất canh bộ lọc `ownerId` của câu
          // `deleteMany`: thiếu bộ lọc ấy thì lệnh xoá một điểm đến quét sạch cả thư viện ảnh.
          {
            ownerType: 'DESTINATION',
            ownerId: destId(2),
            publicId: 'tourism/destinations/hanoi/old-quarter',
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 1,
          },
        ],
      });

      const res = await remove(destId(1), adminCookie);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ slug: 'hoi-an' });
      expect(await prisma.destination.count({ where: { id: destId(1) } })).toBe(0);
      expect(
        await prisma.mediaAsset.count({ where: { ownerType: 'DESTINATION', ownerId: destId(1) } }),
      ).toBe(0);
      expect(
        await prisma.mediaAsset.count({ where: { ownerType: 'DESTINATION', ownerId: destId(2) } }),
      ).toBe(1);
      expect(await prisma.mediaAsset.count({ where: { ownerId: borrower.id } })).toBe(1);
      // ADR-0053 §4: file Cloudinary KHÔNG vào hàng dọn — tour đang dùng nó.
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('còn liên kết với tour NHÁP → 409 IN_USE, không gì đổi', async () => {
      await tourVisiting('draft-one', [destId(1)], false);

      const res = await remove(destId(1), adminCookie);

      expect(res.statusCode).toBe(409);
      expect((res.json() as { code: string }).code).toBe('IN_USE');
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(1) } })).toBe(1);
    });

    it('id lạ → 404 NOT_FOUND', async () => {
      // Khớp cả CÂU của contract: route chưa tồn tại cũng trả 404 kèm `NOT_FOUND`, nên ca chỉ
      // khớp mã đã xanh ngay lúc chạy đỏ, khi chưa có lệnh xoá nào (đo 05/10).
      const res = await remove(destId(999), adminCookie);
      expect(res.statusCode).toBe(404);
      expect((res.json() as { code: string }).code).toBe('NOT_FOUND');
      expect(res.json()).toMatchObject({ message: 'Destination not found' });
    });

    it('xoá ngoài API (SQL tay, Prisma Client) khi còn tour → khoá ngoại từ chối, tour giữ điểm đến (AMEND 2, G25)', async () => {
      // Phép đếm dưới khoá hàng (§3) chỉ canh lệnh xoá của API; SQL tay, Prisma Studio hay một
      // script không đi qua nó. Trước AMEND 2 khoá ngoại là CASCADE: cả hai câu dưới chạy êm và
      // tour mất hai điểm đến mà không ai được báo.
      const tour = await tourVisiting('guarded', [destId(1), destId(2)]);

      await expect(
        prisma.$executeRaw`DELETE FROM destinations WHERE id = ${destId(1)}::uuid`,
      ).rejects.toThrow(/tour_destinations_destination_id_fkey/);
      await expect(prisma.destination.delete({ where: { id: destId(2) } })).rejects.toMatchObject({
        code: 'P2003',
      });

      expect(
        await prisma.destination.count({ where: { id: { in: [destId(1), destId(2)] } } }),
      ).toBe(2);
      expect(await prisma.tourDestination.count({ where: { tourId: tour.id } })).toBe(2);
    });

    /**
     * Số câu lệnh đang ĐỨNG CHỜ transaction của backend `holderPid` kết thúc. Chờ khoá hàng trong
     * Postgres là chờ khoá `transactionid` của transaction đang giữ hàng ấy: một dòng `pg_locks`
     * CHƯA được cấp, cùng `transactionid` với khoá mà chính backend kia đang giữ. Lọc theo pid
     * của backend ấy (không theo DB: khoá `transactionid` không mang `database`) — session song
     * song chạy int test trên DB khác không lọt vào số đếm.
     */
    const waitersOn = async (holderPid: number) => {
      const [row] = await prisma.$queryRaw<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting
        FROM pg_locks waiter
        JOIN pg_locks holder
          ON holder.locktype = 'transactionid'
         AND holder.transactionid = waiter.transactionid
         AND holder.granted
         AND holder.pid = ${holderPid}
        WHERE waiter.locktype = 'transactionid'
          AND NOT waiter.granted
      `;
      return row?.waiting ?? 0;
    };

    it('đua: lệnh gắn tour giữ khoá trước → lệnh xoá thấy liên kết, trả 409', async () => {
      // ADR-0053 §3. Thiếu `FOR UPDATE` thì lệnh xoá đếm 0 (liên kết chưa commit) rồi chờ khoá
      // ở câu DELETE. Trước AMEND 2, CASCADE gỡ đúng liên kết vừa commit: 200 và tour mất điểm
      // đến; từ AMEND 2 khoá ngoại RESTRICT từ chối câu DELETE và lệnh xoá ra lỗi chung thay
      // vì 409 — vẫn đỏ, vì ca này đòi đúng `IN_USE` của phép đếm.
      const tour = await tourVisiting('racing-tour', [destId(2)]);
      let inserted!: (pid: number) => void;
      const didInsert = new Promise<number>((resolve) => {
        inserted = resolve;
      });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const linking = prisma.$transaction(
        async (tx) => {
          await tx.tourDestination.create({
            data: { tourId: tour.id, destinationId: destId(1), isPrimary: false },
          });
          const [me] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          inserted(me?.pid ?? 0);
          await gate;
        },
        { timeout: 15_000 },
      );
      const linkerPid = await didInsert;

      const deleting = remove(destId(1), adminCookie);
      try {
        // Commit lệnh gắn CHỈ khi lệnh xoá đã đứng chờ sau khoá hàng (thấy ở `pg_locks`; cùng nếp
        // ca khoá thứ tự danh mục). Bản cũ chờ cứng 300 ms: máy tải nặng thì lệnh gắn có thể
        // commit TRƯỚC khi lệnh xoá tới nơi, lệnh xoá thấy liên kết rồi trả 409 cả khi thiếu
        // `FOR UPDATE` — ca xanh oan. Có câu chờ thì cả hai bản cùng đứng ở khoá: bản thiếu
        // `FOR UPDATE` chờ ở câu DELETE và không ra 409 (đỏ), bản đúng chờ ở `SELECT … FOR UPDATE`.
        await vi.waitFor(async () => expect(await waitersOn(linkerPid)).toBe(1), {
          timeout: 5_000,
          interval: 50,
        });
      } finally {
        // Nhả ở MỌI kết cục rồi chờ cả hai chạy hết: ca hỏng giữa chừng không được để transaction
        // treo, hay một lệnh xoá còn đang bay, lọt sang ca sau.
        release();
        await linking;
        await deleting;
      }
      const res = await deleting;

      expect(res.statusCode).toBe(409);
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(1) } })).toBe(1);
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

    it('đổi hay ẩn một điểm đến bust cả trang chi tiết của MỌI tour gắn nó', async () => {
      // Trang `/tours/<slug>` đọc tên điểm đến qua tag `tour:<slug>`, không qua
      // `tours` — bust riêng `tours` thì trang ấy giữ tên cũ tới hết 300 giây
      // ISR (nợ G5, đóng ở vòng review F15).
      await tourVisiting('published-one', [destId(1)]);
      await tourVisiting('draft-one', [destId(1)], false);
      await tourVisiting('published-two', [destId(2)]);
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await update(destId(1), UPDATE, adminCookie);
      await setActive(destId(1), false, adminCookie);

      expect(revalidate).toHaveBeenCalledTimes(2);
      for (const call of revalidate.mock.calls) {
        expect([...call[0]].sort()).toEqual(['tour:draft-one', 'tour:published-one', 'tours']);
      }
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

    it('xoá hàng đang hiện bust `tours` đúng một lần, SAU commit — lúc bust hàng đã mất (review S3)', async () => {
      // Mock đọc DB như ca đầu khối, NHƯNG với lệnh xoá (một transaction) chứng cứ thứ tự là số
      // transaction còn mở ngay lúc bust được gọi — xem `trackOpenTransactions`. Chỉ đếm số lần
      // gọi thì dời bust vào trong transaction xoá vẫn xanh, trong khi web lúc ấy regenerate từ
      // bản cũ.
      const openTransactions = trackOpenTransactions();
      const seen: Array<{ tags: string[]; open: number; remaining: number }> = [];
      const revalidate = vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        const open = openTransactions();
        const remaining = await prisma.destination.count({ where: { id: destId(1) } });
        seen.push({ tags, open, remaining });
      });

      expect((await remove(destId(1), adminCookie)).statusCode).toBe(200);

      expect(revalidate).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toEqual({ tags: ['tours'], open: 0, remaining: 0 });
    });

    it('xoá hàng đang ẨN không bust — web không hiện hàng ẩn nên không trang nào đổi (EF4)', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      expect((await remove(destId(3), adminCookie)).statusCode).toBe(200);

      expect(await prisma.destination.count({ where: { id: destId(3) } })).toBe(0);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('xoá hỏng thì không bust', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await tourVisiting('draft-one', [destId(1)], false);
      await remove(destId(1), adminCookie);
      await remove(destId(999), adminCookie);

      expect(revalidate).not.toHaveBeenCalled();
    });
  });
  describe('ảnh điểm đến (Media B, ADR-0060 §8)', () => {
    const DEST = destId(1);
    const HERO = 'tourism/catalog/destination/hoi-an/hero';
    const LANTERNS = 'tourism/catalog/destination/hoi-an/lanterns';
    const upload = (name: string, id = DEST) => `tourism/destinations/${id}/${name}`;
    const UPLOAD_META = {
      version: '1786999999',
      width: 2000,
      height: 1333,
      format: 'jpg',
      bytes: 523000,
    };

    const photos = (slug: string, cookie: string) =>
      app.inject({
        method: 'GET',
        url: `/api/admin/destinations/${slug}/photos`,
        headers: { cookie },
      });
    const setPhotos = (id: string, payload: Record<string, unknown>, cookie: string) =>
      app.inject({
        method: 'POST',
        url: `/api/admin/destinations/${id}/photos`,
        headers: { cookie },
        payload,
      });
    const sign = (id: string, payload: Record<string, unknown>, cookie: string) =>
      app.inject({
        method: 'POST',
        url: `/api/admin/destinations/${id}/photo-uploads`,
        headers: { cookie },
        payload,
      });
    const photosOk = async (slug = 'hoi-an') => {
      const res = await photos(slug, adminCookie);
      expect(res.statusCode).toBe(200);
      return AdminDestinationPhotosSchema.parse(res.json());
    };
    const asset = (
      publicId: string,
      patch: Partial<Prisma.MediaAssetUncheckedCreateInput> = {},
    ): Prisma.MediaAssetUncheckedCreateInput => ({
      ownerType: 'DESTINATION',
      ownerId: DEST,
      publicId,
      type: 'IMAGE',
      role: 'gallery',
      sortOrder: 1,
      alt: publicId,
      ...patch,
    });
    const rowsOf = (ownerId = DEST) =>
      prisma.mediaAsset.findMany({
        where: { ownerType: 'DESTINATION', ownerId, type: 'IMAGE' },
        orderBy: { sortOrder: 'asc' },
      });

    /** Thư viện Hội An: bìa catalog có ghi công, một ảnh catalog, một ảnh tải lên, một video. */
    async function seedLibrary() {
      await prisma.mediaAsset.createMany({
        data: [
          asset(LANTERNS, { sortOrder: 1 }),
          asset(HERO, {
            role: 'hero',
            sortOrder: 5,
            author: 'J. Nguyen',
            license: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          }),
          asset(upload('up-1'), { sortOrder: 2, width: 1800, height: 1200, version: '1786000000' }),
          // Video không hiện ở trang Photos — lệnh thay ảnh không được đụng tới nó.
          asset('tourism/catalog/destination/hoi-an/clip', { type: 'VIDEO', sortOrder: 3 }),
        ],
      });
    }

    it('đọc theo slug: bìa đầu, nguồn suy từ thư mục, số tour mượn đếm theo tour, không có video', async () => {
      await seedLibrary();
      const borrowerA = await tourVisiting('borrower-a', [destId(2)]);
      const borrowerB = await tourVisiting('borrower-b', [destId(2)]);
      await prisma.mediaAsset.createMany({
        data: [borrowerA.id, borrowerB.id].map((ownerId) => ({
          ownerType: 'TOUR' as const,
          ownerId,
          publicId: LANTERNS,
          type: 'IMAGE' as const,
          role: 'gallery' as const,
          sortOrder: 1,
        })),
      });

      const page = await photosOk();

      const destination = await prisma.destination.findUniqueOrThrow({ where: { id: DEST } });
      expect(page).toMatchObject({
        id: DEST,
        name: 'Hội An',
        slug: 'hoi-an',
        isActive: true,
        version: destination.updatedAt.toISOString(),
      });
      expect(page.photos.map((p) => [p.publicId, p.source, p.usedByTours])).toEqual([
        [HERO, 'CATALOG', 0],
        [LANTERNS, 'CATALOG', 2],
        [upload('up-1'), 'UPLOAD', 0],
      ]);
      expect(page.photos[0]).toMatchObject({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' });
    });

    it('slug lạ → 404 NOT_FOUND', async () => {
      const res = await photos('no-such-place', adminCookie);
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('NOT_FOUND');
    });

    it('thay trọn danh sách: thứ tự mới, alt mới, ảnh vừa tải lên; giữ ghi công và số đo dòng cũ', async () => {
      await seedLibrary();
      const before = await photosOk();

      const res = await setPhotos(
        DEST,
        {
          version: before.version,
          photos: [
            { publicId: upload('up-1'), alt: 'Lantern street at dusk' },
            { publicId: upload('new-1'), alt: 'Thu Bon river', upload: UPLOAD_META },
            { publicId: HERO, alt: 'Old town roofs' },
            { publicId: LANTERNS, alt: 'Lanterns' },
          ],
        },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const saved = AdminDestinationPhotosSchema.parse(res.json());
      expect(saved.photos.map((p) => [p.publicId, p.alt, p.source])).toEqual([
        [upload('up-1'), 'Lantern street at dusk', 'UPLOAD'],
        [upload('new-1'), 'Thu Bon river', 'UPLOAD'],
        [HERO, 'Old town roofs', 'CATALOG'],
        [LANTERNS, 'Lanterns', 'CATALOG'],
      ]);
      expect(Date.parse(saved.version)).toBeGreaterThan(Date.parse(before.version));

      const rows = await rowsOf();
      expect(rows.map((r) => [r.publicId, r.role, r.sortOrder])).toEqual([
        [upload('up-1'), 'hero', 0],
        [upload('new-1'), 'gallery', 1],
        [HERO, 'gallery', 2],
        [LANTERNS, 'gallery', 3],
      ]);
      expect(rows.find((r) => r.publicId === upload('up-1'))).toMatchObject({
        width: 1800,
        version: '1786000000',
      });
      expect(rows.find((r) => r.publicId === upload('new-1'))).toMatchObject({
        width: 2000,
        height: 1333,
        bytes: 523000,
        format: 'jpg',
        version: '1786999999',
        author: null,
        license: null,
      });
      expect(rows.find((r) => r.publicId === HERO)).toMatchObject({
        author: 'J. Nguyen',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      });
      // Video vẫn còn — trang Photos không hiện nó nên lệnh thay không được xoá nó.
      expect(await prisma.mediaAsset.count({ where: { ownerId: DEST, type: 'VIDEO' } })).toBe(1);
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('gỡ ảnh: chỉ ảnh tải lên của điểm đến vào hàng dọn; tour mượn giữ dòng của mình', async () => {
      await seedLibrary();
      const borrower = await tourVisiting('borrower', [destId(2)]);
      await prisma.mediaAsset.create({
        data: {
          ownerType: 'TOUR',
          ownerId: borrower.id,
          publicId: LANTERNS,
          type: 'IMAGE',
          role: 'hero',
          sortOrder: 0,
        },
      });
      const before = await photosOk();

      const res = await setPhotos(
        DEST,
        { version: before.version, photos: [{ publicId: HERO, alt: 'Old town roofs' }] },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const queued = await prisma.mediaGarbage.findMany({ select: { publicId: true } });
      expect(queued.map((q) => q.publicId)).toEqual([upload('up-1')]);
      expect(await prisma.mediaAsset.count({ where: { ownerId: borrower.id } })).toBe(1);
    });

    it('danh sách rỗng hợp lệ — mọi dòng ảnh của điểm đến đi, video ở lại', async () => {
      await seedLibrary();
      const before = await photosOk();

      const res = await setPhotos(DEST, { version: before.version, photos: [] }, adminCookie);

      expect(res.statusCode).toBe(200);
      expect(AdminDestinationPhotosSchema.parse(res.json()).photos).toEqual([]);
      expect(await rowsOf()).toEqual([]);
      expect(await prisma.mediaAsset.count({ where: { ownerId: DEST, type: 'VIDEO' } })).toBe(1);
    });

    it('phiên bản cũ → 409 STALE_DESTINATION, không gì đổi; lệnh sửa tên cũng làm phiên bản cũ', async () => {
      await seedLibrary();
      const before = await photosOk();
      // Lệnh sửa tên không so phiên bản, nhưng chạm `updatedAt` (ADR-0060 §8).
      expect((await update(DEST, UPDATE, adminCookie)).statusCode).toBe(200);

      const res = await setPhotos(
        DEST,
        { version: before.version, photos: [{ publicId: HERO, alt: 'Only' }] },
        adminCookie,
      );

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('STALE_DESTINATION');
      expect((await rowsOf()).length).toBe(3);
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('ảnh không thuộc hai nguồn → 400 PHOTO_NOT_ALLOWED, cả lệnh không ghi gì', async () => {
      await seedLibrary();
      // Ảnh thư viện của Hà Nội: điểm đến không mượn ảnh của nhau.
      await prisma.mediaAsset.create({
        data: asset('tourism/catalog/destination/hanoi/1', { ownerId: destId(2) }),
      });
      const before = await photosOk();

      for (const stranger of [
        { publicId: 'tourism/catalog/destination/hanoi/1', alt: 'x' },
        { publicId: upload('theirs', destId(2)), alt: 'x', upload: UPLOAD_META },
        { publicId: upload('no-meta'), alt: 'x' },
      ]) {
        const res = await setPhotos(
          DEST,
          { version: before.version, photos: [{ publicId: HERO, alt: 'Kept' }, stranger] },
          adminCookie,
        );
        expect(res.statusCode).toBe(400);
        expect(res.json().code).toBe('PHOTO_NOT_ALLOWED');
      }
      expect((await rowsOf()).map((r) => r.publicId).sort()).toEqual(
        [HERO, LANTERNS, upload('up-1')].sort(),
      );
      // Rollback trọn: phiên bản không đổi, lần lưu đúng kế tiếp vẫn đi được.
      expect((await photosOk()).version).toBe(before.version);
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('id lạ → 404 NOT_FOUND ở cả lệnh lưu lẫn lệnh ký, không ký gì', async () => {
      const missing = destId(999);
      const saved = await setPhotos(
        missing,
        { version: new Date().toISOString(), photos: [] },
        adminCookie,
      );
      expect(saved.statusCode).toBe(404);
      expect(saved.json().code).toBe('NOT_FOUND');
      expect((await sign(missing, { count: 1 }, adminCookie)).statusCode).toBe(404);
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('ký đúng count bộ trong thư mục của điểm đến, cả lô vào hàng dọn', async () => {
      const res = await sign(DEST, { count: 2 }, adminCookie);

      expect(res.statusCode).toBe(200);
      const params = SignedUploadParamsSchema.array().parse(res.json());
      expect(params).toHaveLength(2);
      for (const p of params) {
        expect(p.folder).toBe(`tourism/destinations/${DEST}`);
        expect(p.overwrite).toBe(false);
      }
      const queued = await prisma.mediaGarbage.findMany({ select: { publicId: true } });
      expect(queued.map((q) => q.publicId).sort()).toEqual(
        params.map((p) => `${p.folder}/${p.publicId}`).sort(),
      );
      expect((await sign(DEST, { count: 31 }, adminCookie)).statusCode).toBe(400);
    });

    it('xoá điểm đến đưa ảnh tải lên của nó vào lại hàng dọn; ảnh catalog thì không', async () => {
      await seedLibrary();

      expect((await remove(DEST, adminCookie)).statusCode).toBe(200);

      const queued = await prisma.mediaGarbage.findMany({ select: { publicId: true } });
      expect(queued.map((q) => q.publicId)).toEqual([upload('up-1')]);
    });

    it('bust `tours` và trang của mọi tour gắn điểm đến, SAU commit', async () => {
      await seedLibrary();
      await tourVisiting('visits-hoi-an', [DEST]);
      const before = await photosOk();
      const openTransactions = trackOpenTransactions();
      const seen: Array<{ tags: string[]; open: number }> = [];
      vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        seen.push({ tags: [...tags].sort(), open: openTransactions() });
      });

      await setPhotos(
        DEST,
        { version: before.version, photos: [{ publicId: HERO, alt: 'Roofs' }] },
        adminCookie,
      );

      expect(seen).toEqual([{ tags: ['tour:visits-hoi-an', 'tours'], open: 0 }]);
    });

    it('Staff dùng được cả ba; khách 403; chưa đăng nhập 401', async () => {
      await seedLibrary();
      const res = await photos('hoi-an', staffCookie);
      expect(res.statusCode).toBe(200);
      const { version } = AdminDestinationPhotosSchema.parse(res.json());
      expect(
        (
          await setPhotos(
            DEST,
            { version, photos: [{ publicId: HERO, alt: 'Roofs' }] },
            staffCookie,
          )
        ).statusCode,
      ).toBe(200);
      expect((await sign(DEST, { count: 1 }, staffCookie)).statusCode).toBe(200);

      for (const cookie of [customerCookie, '']) {
        const expected = cookie === '' ? 401 : 403;
        expect((await photos('hoi-an', cookie)).statusCode).toBe(expected);
        expect((await setPhotos(DEST, { version, photos: [] }, cookie)).statusCode).toBe(expected);
        expect((await sign(DEST, { count: 1 }, cookie)).statusCode).toBe(expected);
      }
    });
  });
});
