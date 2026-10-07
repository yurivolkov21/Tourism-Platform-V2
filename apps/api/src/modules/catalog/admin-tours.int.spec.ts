import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminPhotoLibrarySchema,
  AdminTourCreateResultSchema,
  AdminTourDeleteResultSchema,
  type AdminTourDetail,
  AdminTourDetailSchema,
  SignedUploadParamsSchema,
  vietnamToday,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, PaymentProvider, ReviewSource } from '../../generated/prisma/enums.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';

/**
 * Integration (Docker PG, db `tourism_test`) — khu làm việc tour (spec F17,
 * ADR-0047). Bốn ca đắt nhất:
 *
 *  ① Hai lệnh sửa cùng một `version` bắn cùng lúc: ĐÚNG MỘT lệnh qua, lệnh kia
 *    `STALE_TOUR` — phép so nằm trong câu `UPDATE` chứ không ở một câu đọc riêng.
 *  ② Lưu tab con cũng đẩy `version` — lưu Itinerary xong thì form Details mở
 *    trước đó phải bị từ chối.
 *  ③ Tour đang bán không bao giờ trở nên thiếu: lệnh làm thiếu bị từ chối và
 *    rollback trọn.
 *  ④ Xoá kéo theo đúng các bảng con, giữ câu hỏi của khách, và bị khoá ngoại
 *    chặn khi tour đã có booking.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const CUSTOMER_EMAIL = 'tour-editor-customer@example.com';

const uuid = (prefix: string, n: number) =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tourId = (n: number) => uuid('f1700001', n);
const CATEGORY_ID = uuid('f1700002', 1);
const OTHER_CATEGORY_ID = uuid('f1700002', 2);
const DEST_1 = uuid('f1700003', 1);
const DEST_2 = uuid('f1700003', 2);
const DEST_3 = uuid('f1700003', 3);
const MISSING = uuid('f17000ff', 1);

/** Ngày lịch Việt Nam hôm nay lệch `offset` ngày, khuôn 00:00 UTC của `@db.Date`. */
const today = vietnamToday(new Date());
const day = (offset: number) => {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};

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

describe('admin tours integration (F17)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;
  let web: WebRevalidationService;

  beforeAll(async () => {
    // Int spec chạy tuần tự (`fileParallelism: false`), nên dọn cả `posts` ở đây
    // không giẫm lên `posts.int.spec.ts`.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, tour_categories, destinations, media_assets, posts CASCADE',
    );

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
    customerId = (await prisma.user.findUniqueOrThrow({ where: { email: CUSTOMER_EMAIL } })).id;
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Booking trỏ tour bằng khoá ngoại RESTRICT — xoá booking TRƯỚC tour.
    await prisma.booking.deleteMany();
    await prisma.enquiry.deleteMany();
    await prisma.post.deleteMany();
    // media_assets là bảng đa chủ, KHÔNG có khoá ngoại tới `tours` (ADR-0048) —
    // xoá tour không kéo dòng ảnh theo, nên id tour dùng lại giữa các ca sẽ nhặt
    // nhầm ảnh của ca trước.
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaGarbage.deleteMany();
    await prisma.tour.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.tourCategory.createMany({
      data: [
        { id: CATEGORY_ID, slug: 'day-trips', name: 'Day trips', order: 1 },
        { id: OTHER_CATEGORY_ID, slug: 'retired', name: 'Retired', order: 2, isActive: false },
      ],
    });
    await prisma.destination.createMany({
      data: [
        { id: DEST_1, slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' },
        { id: DEST_2, slug: 'hanoi', name: 'Hà Nội', region: 'Northern Vietnam' },
        {
          id: DEST_3,
          slug: 'an-bang',
          name: 'An Bàng',
          region: 'Central Vietnam',
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Một tour ĐỦ để bán, 2 ngày, đang bán, có ảnh bìa — ca nào cần khác thì đè bằng `patch`. */
  const makeTour = async (n: number, patch: Partial<Prisma.TourUncheckedCreateInput> = {}) => {
    const tour = await prisma.tour.create({
      data: {
        id: tourId(n),
        slug: `f17-tour-${n}`,
        title: `F17 Tour ${n}`,
        summary: 'A day on the water.',
        categoryId: CATEGORY_ID,
        durationDays: 2,
        maxGroupSize: 12,
        basePrice: '99.00',
        isPublished: true,
        destinations: { create: [{ destinationId: DEST_1, isPrimary: true }] },
        itinerary: {
          create: [
            { dayNumber: 1, title: 'Arrive' },
            { dayNumber: 2, title: 'Leave' },
          ],
        },
        ...patch,
      },
    });
    await prisma.mediaAsset.create({
      data: {
        ownerType: 'TOUR',
        ownerId: tour.id,
        publicId: `tourism/catalog/tour/f17-${n}`,
        type: 'IMAGE',
        role: 'hero',
        sortOrder: 0,
        alt: `Cover of tour ${n}`,
        version: '1700000000',
      },
    });
    return tour;
  };

  const makeDeparture = (
    tour: string,
    patch: Partial<Prisma.TourDepartureUncheckedCreateInput> & { startDate: Date; endDate: Date },
  ) => prisma.tourDeparture.create({ data: { tourId: tour, seatsTotal: 10, ...patch } });

  /** Booking tối thiểu — khuôn `admin-catalog.int.spec.ts`. */
  const makeBooking = async (tour: string, departure: string, code: string) =>
    prisma.booking.create({
      data: {
        code,
        userId: customerId,
        tourId: tour,
        departureId: departure,
        numAdults: 1,
        totalAmount: '99.00',
        status: BookingStatus.PAID,
        tourTitle: 'F17 Tour',
        departureStartDate: day(30),
        departureEndDate: day(31),
        unitPrice: '99.00',
        contactName: 'Ada Lovelace',
        contactEmail: 'ada@example.com',
        paymentProvider: PaymentProvider.STRIPE,
        paidAt: new Date(),
      },
    });

  const get = (slug: string, cookie = adminCookie) =>
    app.inject({ method: 'GET', url: `/api/admin/tours/${slug}`, headers: { cookie } });
  const post = (url: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const create = (payload: Record<string, unknown>, cookie = adminCookie) =>
    post('/api/admin/tours', payload, cookie);
  const remove = (id: string, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/delete`, {}, cookie);
  const details = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/details`, payload, cookie);
  const itinerary = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/itinerary`, payload, cookie);
  const faqsPolicies = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/faqs-policies`, payload, cookie);
  const costs = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/costs`, payload, cookie);
  const signUploads = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/photo-uploads`, payload, cookie);
  const library = (cookie = adminCookie) =>
    app.inject({ method: 'GET', url: '/api/admin/tour-photo-library', headers: { cookie } });
  const photosWrite = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/photos`, payload, cookie);
  const LIB_1 = 'tourism/catalog/destination/hoi-an/1';
  const LIB_2 = 'tourism/catalog/destination/hoi-an/2';
  const mine = (n: number, name: string) => `tourism/tours/${tourId(n)}/${name}`;
  const UPLOAD_META = {
    version: '1759000000',
    width: 2000,
    height: 1333,
    format: 'jpg',
    bytes: 523000,
  };
  /** Kho địa danh: LIB_1 có đủ ghi công — ca "chép ghi công" cần nó KHÁC thứ client gửi. */
  const makeLibrary = () =>
    prisma.mediaAsset.createMany({
      data: [
        {
          ownerType: 'DESTINATION',
          ownerId: DEST_1,
          publicId: LIB_1,
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 1,
          alt: 'Lanterns at dusk',
          width: 2400,
          height: 1600,
          version: '1600000001',
          author: 'J. Nguyen',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lanterns.jpg',
        },
        {
          ownerType: 'DESTINATION',
          ownerId: DEST_1,
          publicId: LIB_2,
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 2,
          alt: 'Old town',
          version: '1600000002',
        },
      ],
    });
  const tourPhotoRows = (n: number) =>
    prisma.mediaAsset.findMany({
      where: { ownerType: 'TOUR', ownerId: tourId(n) },
      orderBy: { sortOrder: 'asc' },
    });

  /** Payload tab Details dựng từ CHÍNH tour đang đọc — ca nào cần khác thì đè. */
  const detailsPayload = (detail: AdminTourDetail, patch: Record<string, unknown> = {}) => ({
    id: detail.id,
    version: detail.version,
    title: detail.title,
    summary: detail.summary,
    categoryId: detail.categoryId,
    difficulty: detail.difficulty,
    isFeatured: detail.isFeatured,
    durationDays: detail.durationDays,
    maxGroupSize: detail.maxGroupSize,
    basePrice: detail.basePrice,
    destinations: detail.destinations,
    suitableFor: detail.suitableFor,
    badges: detail.badges,
    highlights: detail.highlights,
    included: detail.included,
    excluded: detail.excluded,
    meetingPoint: detail.meetingPoint,
    factDurationNote: detail.factDurationNote,
    factGroupSizeNote: detail.factGroupSizeNote,
    factDifficultyNote: detail.factDifficultyNote,
    factGoodForNote: detail.factGoodForNote,
    ...patch,
  });

  const detailOf = async (slug: string) => {
    const res = await get(slug);
    expect(res.statusCode).toBe(200);
    return AdminTourDetailSchema.parse(res.json());
  };

  const CREATE = {
    title: 'Hoi An Lantern Walk',
    slug: 'hoi-an-lantern-walk',
    categoryId: CATEGORY_ID,
    primaryDestinationId: DEST_1,
    durationDays: 1,
    maxGroupSize: 10,
    basePrice: '45.00',
  };

  /**
   * Một danh mục và một điểm đến VỪA BỊ XOÁ — kịch bản review S1: danh sách chọn của form nạp
   * lúc mở vẫn còn chúng, rồi một tab khác xoá đi trước khi form lưu.
   */
  const deletedLinks = async () => {
    const category = await prisma.tourCategory.create({
      data: { slug: 'gone-category', name: 'Gone category', order: 9 },
    });
    const destination = await prisma.destination.create({
      data: { slug: 'gone-destination', name: 'Gone destination', region: 'Central Vietnam' },
    });
    await prisma.tourCategory.delete({ where: { id: category.id } });
    await prisma.destination.delete({ where: { id: destination.id } });
    return { categoryId: category.id, destinationId: destination.id };
  };

  /** Phán quyết "danh mục hay điểm đến không còn" — mã RIÊNG, không trùng "tour không còn". */
  const LINK_GONE = { code: 'LINK_NOT_FOUND', message: 'Category or destination not found' };

  describe('guard', () => {
    it('khách thường thì mọi đường đều 403', async () => {
      await makeTour(1);
      expect((await get('f17-tour-1', customerCookie)).statusCode).toBe(403);
      expect((await create(CREATE, customerCookie)).statusCode).toBe(403);
      expect((await remove(tourId(1), customerCookie)).statusCode).toBe(403);
      expect((await details(tourId(1), {}, customerCookie)).statusCode).toBe(403);
      expect((await itinerary(tourId(1), {}, customerCookie)).statusCode).toBe(403);
      expect((await faqsPolicies(tourId(1), {}, customerCookie)).statusCode).toBe(403);
      expect((await costs(tourId(1), {}, customerCookie)).statusCode).toBe(403);
      expect(
        (await signUploads(tourId(1), { id: tourId(1), count: 1 }, customerCookie)).statusCode,
      ).toBe(403);
      expect((await library(customerCookie)).statusCode).toBe(403);
      expect((await photosWrite(tourId(1), {}, customerCookie)).statusCode).toBe(403);
    });

    it('chưa đăng nhập thì mọi đường đều 401', async () => {
      await makeTour(1);
      expect((await get('f17-tour-1', '')).statusCode).toBe(401);
      expect((await create(CREATE, '')).statusCode).toBe(401);
      expect((await remove(tourId(1), '')).statusCode).toBe(401);
      expect((await details(tourId(1), {}, '')).statusCode).toBe(401);
      expect((await itinerary(tourId(1), {}, '')).statusCode).toBe(401);
      expect((await faqsPolicies(tourId(1), {}, '')).statusCode).toBe(401);
      expect((await costs(tourId(1), {}, '')).statusCode).toBe(401);
      expect((await signUploads(tourId(1), { id: tourId(1), count: 1 }, '')).statusCode).toBe(401);
      expect((await library('')).statusCode).toBe(401);
      expect((await photosWrite(tourId(1), {}, '')).statusCode).toBe(401);
    });
  });

  describe('get', () => {
    it('trả đủ tour, danh sách con theo thứ tự, version có mili-giây', async () => {
      await makeTour(1, {
        isPublished: false,
        durationDays: 3,
        destinations: {
          create: [
            { destinationId: DEST_2, isPrimary: false },
            { destinationId: DEST_1, isPrimary: true },
          ],
        },
        itinerary: {
          create: [
            { dayNumber: 3, title: 'Third' },
            { dayNumber: 1, title: 'First' },
          ],
        },
        faqs: {
          create: [
            { question: 'Second?', answer: 'B', order: 1 },
            { question: 'First?', answer: 'A', order: 0 },
          ],
        },
        costItems: {
          create: [
            {
              category: 'GUIDE',
              label: 'Guide',
              amount: '40.00',
              basis: 'PER_DEPARTURE',
              sortOrder: 1,
            },
            {
              category: 'MEALS',
              label: 'Lunch',
              amount: '8.50',
              basis: 'PER_PERSON',
              sortOrder: 0,
            },
          ],
        },
      });
      const row = await prisma.tour.findUniqueOrThrow({ where: { id: tourId(1) } });

      const detail = await detailOf('f17-tour-1');

      // Tour TẮT bán vẫn đọc được — khu làm việc là nơi soạn tour chưa bán.
      expect(detail.isPublished).toBe(false);
      expect(detail.version).toBe(row.updatedAt.toISOString());
      expect(detail.destinations).toEqual([
        { destinationId: DEST_1, isPrimary: true },
        { destinationId: DEST_2, isPrimary: false },
      ]);
      expect(detail.itinerary.map((d) => d.dayNumber)).toEqual([1, 3]);
      expect(detail.faqs.map((f) => f.question)).toEqual(['First?', 'Second?']);
      expect(detail.costItems.map((c) => c.label)).toEqual(['Lunch', 'Guide']);
      expect(detail.costItems[0]?.amount).toBe('8.50');
      expect(detail.readiness).toEqual({
        summary: true,
        primaryDestination: true,
        missingDays: [2],
        cover: true,
        ready: false,
      });
    });

    it('đếm chuyến, booking và sàn ghế theo giai đoạn', async () => {
      await makeTour(1);
      await makeDeparture(tourId(1), { startDate: day(-10), endDate: day(-9), seatsTotal: 30 }); // đã về
      await makeDeparture(tourId(1), {
        startDate: day(20),
        endDate: day(21),
        seatsTotal: 40,
        status: 'CANCELLED',
      });
      const live = await makeDeparture(tourId(1), {
        startDate: day(30),
        endDate: day(31),
        seatsTotal: 11,
      });
      await makeBooking(tourId(1), live.id, 'BK-F17GET01');

      const detail = await detailOf('f17-tour-1');

      expect(detail.departureCount).toBe(3);
      expect(detail.liveSeatsMax).toBe(11);
      expect(detail.bookingCount).toBe(1);
    });

    it('slug không có thì 404 với câu của contract', async () => {
      const res = await get('no-such-tour');
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Tour not found' });
    });

    it('trả ảnh theo thứ tự hiển thị, mỗi ảnh mang nguồn và ghi công (F18)', async () => {
      await makeTour(1);
      // LIB_1 có dòng DESTINATION → LIBRARY; ảnh bìa gốc thì không → CATALOG (AMEND 1).
      await makeLibrary();
      const media = (publicId: string, patch: Partial<Prisma.MediaAssetUncheckedCreateInput>) =>
        prisma.mediaAsset.create({
          data: {
            ownerType: 'TOUR',
            ownerId: tourId(1),
            publicId,
            type: 'IMAGE',
            role: 'gallery',
            alt: publicId,
            ...patch,
          },
        });
      // Ảnh bìa mang sortOrder LỚN nhất: seed không bảo đảm nó là 0, và DB vốn đã
      // sắp theo sortOrder — ảnh bìa ở 0 thì thiếu `orderTourPhotos` vẫn xanh.
      await prisma.mediaAsset.updateMany({
        where: { ownerId: tourId(1), role: 'hero' },
        data: { sortOrder: 9 },
      });
      // Chèn NGƯỢC thứ tự hiển thị — kết quả phải sắp lại, không theo thứ tự tạo.
      await media(`tourism/tours/${tourId(1)}/uploaded`, { sortOrder: 2, version: '1700000002' });
      await media('tourism/catalog/destination/hoi-an/1', {
        sortOrder: 1,
        author: 'J. Nguyen',
        license: 'CC BY-SA 4.0',
      });

      const detail = await detailOf('f17-tour-1');

      expect(detail.photos.map((p) => [p.publicId, p.source])).toEqual([
        ['tourism/catalog/tour/f17-1', 'CATALOG'],
        ['tourism/catalog/destination/hoi-an/1', 'LIBRARY'],
        [`tourism/tours/${tourId(1)}/uploaded`, 'UPLOAD'],
      ]);
      expect(detail.photos[1]).toMatchObject({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' });
      expect(detail.photos[2]?.url).toContain(`/v1700000002/tourism/tours/${tourId(1)}/uploaded`);
      expect(detail.readiness.cover).toBe(true);
    });

    it('publicId chỉ trùng một VIDEO của địa danh thì không phải LIBRARY — hộp thư viện không có nó (G13)', async () => {
      await makeTour(1);
      // Cloudinary cho ảnh và video trùng publicId (khác resource type).
      const clip = 'tourism/catalog/destination/hoi-an/clip';
      await prisma.mediaAsset.createMany({
        data: [
          {
            ownerType: 'DESTINATION',
            ownerId: DEST_1,
            publicId: clip,
            type: 'VIDEO',
            role: 'gallery',
            alt: 'River clip',
          },
          {
            ownerType: 'TOUR',
            ownerId: tourId(1),
            publicId: clip,
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 1,
            alt: 'River still',
          },
        ],
      });

      const detail = await detailOf('f17-tour-1');

      expect(detail.photos.map((p) => [p.publicId, p.source])).toEqual([
        ['tourism/catalog/tour/f17-1', 'CATALOG'],
        [clip, 'CATALOG'],
      ]);
    });

    it('tour chưa có ảnh bìa thì readiness.cover = false và không ready (F18)', async () => {
      await makeTour(1);
      await prisma.mediaAsset.deleteMany({ where: { ownerId: tourId(1) } });

      const detail = await detailOf('f17-tour-1');

      expect(detail.readiness.cover).toBe(false);
      expect(detail.readiness.ready).toBe(false);
    });
  });

  describe('create', () => {
    it('tạo tour TẮT bán, USD, một điểm chính, chưa có giá vốn — và không bust', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await create({ ...CREATE, title: '  Hoi An Lantern Walk  ' });

      expect(res.statusCode).toBe(200);
      const created = AdminTourCreateResultSchema.parse(res.json());
      expect(created.slug).toBe('hoi-an-lantern-walk');
      const row = await prisma.tour.findUniqueOrThrow({
        where: { id: created.id },
        include: { destinations: true, itinerary: true },
      });
      expect(row).toMatchObject({
        title: 'Hoi An Lantern Walk',
        isPublished: false,
        currency: 'USD',
        costPrice: null,
        durationDays: 1,
        maxGroupSize: 10,
      });
      expect(row.basePrice.toFixed(2)).toBe('45.00');
      expect(row.destinations).toEqual([
        expect.objectContaining({ destinationId: DEST_1, isPrimary: true }),
      ]);
      expect(row.itinerary).toEqual([]);
      // Tour mới đang tắt bán — web chưa có trang nào chứa nó.
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('slug trùng thì 409 SLUG_TAKEN, kể cả hai lượt tạo bắn cùng lúc', async () => {
      const [a, b] = await Promise.all([create(CREATE), create(CREATE)]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const loser = a.statusCode === 409 ? a : b;
      expect(loser.json()).toMatchObject({ code: 'SLUG_TAKEN' });
      expect(await prisma.tour.count({ where: { slug: CREATE.slug } })).toBe(1);
    });

    it('danh mục hay điểm đến vừa bị xoá thì 404 LINK_NOT_FOUND, không để lại hàng nào (review S1)', async () => {
      const gone = await deletedLinks();

      const noCategory = await create({ ...CREATE, categoryId: gone.categoryId });
      const noDestination = await create({
        ...CREATE,
        slug: 'other-slug',
        primaryDestinationId: gone.destinationId,
      });

      for (const res of [noCategory, noDestination]) {
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject(LINK_GONE);
      }
      expect(await prisma.tour.count()).toBe(0);
    });

    it('danh mục và điểm đến ĐANG ẨN vẫn chọn được (spec §2b.4)', async () => {
      const res = await create({
        ...CREATE,
        categoryId: OTHER_CATEGORY_ID,
        primaryDestinationId: DEST_3,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('delete', () => {
    it('xoá tour chưa từng có booking kéo theo mọi bảng con, giữ câu hỏi của khách', async () => {
      await makeTour(1, {
        faqs: { create: [{ question: 'Q?', answer: 'A' }] },
        policies: { create: [{ kind: 'GENERAL', title: 'T', body: 'B' }] },
        costItems: {
          create: [{ category: 'MEALS', label: 'Lunch', amount: '8.00', basis: 'PER_PERSON' }],
        },
      });
      await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31) });
      // Một hàng cho mỗi bảng còn lại mà spec §2d và plan (quyết định 4) kể tên.
      await prisma.wishlist.create({ data: { userId: customerId, tourId: tourId(1) } });
      await prisma.review.create({
        data: {
          tourId: tourId(1),
          rating: 5,
          body: 'Lovely evening.',
          authorName: 'Ada',
          source: ReviewSource.CURATED,
          isApproved: true,
        },
      });
      await prisma.post.create({
        data: {
          slug: 'f17-post',
          title: 'Lanterns',
          content: 'A post about lanterns.',
          authorId: customerId,
          relatedTours: { create: [{ tourId: tourId(1) }] },
        },
      });
      const enquiry = await prisma.enquiry.create({
        data: {
          name: 'Ada',
          email: 'ada@example.com',
          message: 'Is it rainy?',
          tourId: tourId(1),
        },
      });

      const res = await remove(tourId(1));

      expect(res.statusCode).toBe(200);
      expect(AdminTourDeleteResultSchema.parse(res.json())).toEqual({ slug: 'f17-tour-1' });
      const where = { tourId: tourId(1) };
      expect(await prisma.tour.count({ where: { id: tourId(1) } })).toBe(0);
      expect(await prisma.tourDeparture.count({ where })).toBe(0);
      expect(await prisma.tourItineraryDay.count({ where })).toBe(0);
      expect(await prisma.tourFaq.count({ where })).toBe(0);
      expect(await prisma.tourPolicy.count({ where })).toBe(0);
      expect(await prisma.tourCostItem.count({ where })).toBe(0);
      expect(await prisma.tourDestination.count({ where })).toBe(0);
      expect(await prisma.wishlist.count({ where })).toBe(0);
      expect(await prisma.review.count({ where })).toBe(0);
      expect(await prisma.postTour.count({ where })).toBe(0);
      // Bài viết còn nguyên — chỉ mất liên kết tới tour.
      expect(await prisma.post.count({ where: { slug: 'f17-post' } })).toBe(1);
      const kept = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
      expect(kept.tourId).toBeNull();
    });

    it('tour đã có booking thì 409 TOUR_HAS_BOOKINGS, không mất gì, không bust', async () => {
      await makeTour(1);
      const departure = await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31) });
      await makeBooking(tourId(1), departure.id, 'BK-F17DEL01');
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await remove(tourId(1));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'TOUR_HAS_BOOKINGS' });
      expect(await prisma.tour.count({ where: { id: tourId(1) } })).toBe(1);
      expect(await prisma.tourDeparture.count({ where: { tourId: tourId(1) } })).toBe(1);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('bust hai tag của tour SAU khi xoá xong', async () => {
      await makeTour(1);
      const seen: Array<{ tags: string[]; exists: boolean }> = [];
      vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        seen.push({ tags, exists: (await prisma.tour.count({ where: { id: tourId(1) } })) > 0 });
      });

      await remove(tourId(1));

      await vi.waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toEqual({ tags: ['tours', 'tour:f17-tour-1'], exists: false });
    });

    it('xoá tour dọn luôn dòng ảnh; ảnh tải lên vào lại hàng dọn, ảnh thư viện thì không (F18)', async () => {
      await makeTour(1, { isPublished: false });
      const mineId = `tourism/tours/${tourId(1)}/mine`;
      await prisma.mediaAsset.create({
        data: {
          ownerType: 'TOUR',
          ownerId: tourId(1),
          publicId: mineId,
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 1,
          alt: 'Mine',
        },
      });

      const res = await remove(tourId(1));

      expect(res.statusCode).toBe(200);
      expect(await prisma.mediaAsset.count({ where: { ownerId: tourId(1) } })).toBe(0);
      // Ảnh bìa của `makeTour` là ảnh catalog (thư viện) — không vào hàng dọn.
      expect((await prisma.mediaGarbage.findMany()).map((q) => q.publicId)).toEqual([mineId]);
    });

    it('tour có booking → 409, dòng ảnh còn nguyên, hàng dọn không đổi (F18)', async () => {
      await makeTour(1);
      const departure = await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31) });
      await makeBooking(tourId(1), departure.id, 'BK-F18DEL01');
      await prisma.mediaAsset.create({
        data: {
          ownerType: 'TOUR',
          ownerId: tourId(1),
          publicId: `tourism/tours/${tourId(1)}/mine`,
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 1,
          alt: 'Mine',
        },
      });

      const res = await remove(tourId(1));

      expect(res.statusCode).toBe(409);
      expect(await prisma.mediaAsset.count({ where: { ownerId: tourId(1) } })).toBe(2);
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('id không có thì 404', async () => {
      const res = await remove(MISSING);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Tour not found' });
    });

    it('xoá tour chen giữa lúc khách đặt chỗ thì khách nhận DEPARTURE_NOT_AVAILABLE, không phải 500', async () => {
      await makeTour(1);
      const departure = await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31) });
      // Chen ĐÚNG khe giữa câu đọc chuyến và câu INSERT của `bookings.create`
      // (vòng review F17): khoá ngoại nổ P2003, trước đây không ai map nên 500.
      const insert = prisma.booking.create.bind(prisma.booking);
      vi.spyOn(prisma.booking, 'create').mockImplementationOnce(((args: Prisma.BookingCreateArgs) =>
        prisma.tour
          .delete({ where: { id: tourId(1) } })
          .then(() => insert(args))) as unknown as typeof prisma.booking.create);

      const res = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: { cookie: customerCookie },
        payload: {
          departureId: departure.id,
          numAdults: 1,
          numChildren: 0,
          contactName: 'Ada Lovelace',
          contactEmail: 'ada@example.com',
          paymentProvider: 'STRIPE',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
      expect(await prisma.tour.count({ where: { id: tourId(1) } })).toBe(0);
      expect(await prisma.booking.count()).toBe(0);
    });
  });

  describe('updateDetails', () => {
    it('ghi các cột của tab, trả tour mới với version mới; slug gửi thừa bị bỏ qua', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await details(
        tourId(1),
        detailsPayload(before, {
          title: 'Renamed',
          slug: 'hijacked-slug',
          highlights: ['Sunset', 'Kayak'],
          difficulty: 'EASY',
        }),
      );

      expect(res.statusCode).toBe(200);
      const after = AdminTourDetailSchema.parse(res.json());
      expect(after.title).toBe('Renamed');
      expect(after.slug).toBe('f17-tour-1');
      expect(after.highlights).toEqual(['Sunset', 'Kayak']);
      expect(after.difficulty).toBe('EASY');
      expect(after.version).not.toBe(before.version);
      expect(Date.parse(after.version)).toBeGreaterThan(Date.parse(before.version));
    });

    it('ghi ĐỦ mọi cột của tab — không cột nào lặng lẽ rơi khỏi lệnh ghi', async () => {
      // Vòng review F17: ca trên chỉ canh bốn cột, nên bỏ một cột khỏi
      // `detailsColumns` (giá, cờ Featured…) là mất dữ liệu mà test vẫn xanh.
      // Mỗi ghi chú một giá trị riêng để một lần tráo ô cũng đỏ.
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      const patch = {
        title: 'All columns',
        summary: 'A brand new summary.',
        categoryId: OTHER_CATEGORY_ID,
        difficulty: 'CHALLENGING',
        isFeatured: true,
        maxGroupSize: 14,
        basePrice: '123.45',
        suitableFor: ['COUPLE', 'SOLO'],
        badges: ['NEW'],
        highlights: ['Sunrise'],
        included: ['Lunch', 'Boat'],
        excluded: ['Tips'],
        meetingPoint: 'Hotel lobby',
        factDurationNote: 'Duration note',
        factGroupSizeNote: 'Group size note',
        factDifficultyNote: 'Difficulty note',
        factGoodForNote: 'Good-for note',
      };

      const res = await details(tourId(1), detailsPayload(before, patch));

      expect(res.statusCode).toBe(200);
      expect(await detailOf('f17-tour-1')).toMatchObject(patch);
    });

    it('phiên bản mới luôn lớn hơn bản cũ, kể cả khi đồng hồ server lùi (quyết định 3)', async () => {
      // Đẩy hàng tour về một mốc TƯƠNG LAI: giả lập đồng hồ server lùi sau lần lưu
      // trước. Câu ghi cột nào quên đặt `updatedAt: next` thì Prisma tự đặt
      // `now()` — phiên bản đi LÙI, và form cầm phiên bản cũ ghi đè được.
      await makeTour(1);
      const future = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.tour.update({ where: { id: tourId(1) }, data: { updatedAt: future } });
      const before = await detailOf('f17-tour-1');

      const saved = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(before, { title: 'After the slip' }))).json(),
      );
      const costed = AdminTourDetailSchema.parse(
        (await costs(tourId(1), { id: tourId(1), version: saved.version, items: [] })).json(),
      );

      expect(Date.parse(saved.version)).toBeGreaterThan(Date.parse(before.version));
      expect(Date.parse(costed.version)).toBeGreaterThan(Date.parse(saved.version));
    });

    it('version cũ thì 409 STALE_TOUR và không đổi gì', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'First save' }));

      const res = await details(tourId(1), detailsPayload(before, { title: 'Stale save' }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_TOUR' });
      expect((await detailOf('f17-tour-1')).title).toBe('First save');
    });

    it('hai lệnh cùng version bắn cùng lúc: đúng MỘT lệnh qua', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const [a, b] = await Promise.all([
        details(tourId(1), detailsPayload(before, { title: 'Writer A' })),
        details(tourId(1), detailsPayload(before, { title: 'Writer B' })),
      ]);

      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const winner = a.statusCode === 200 ? 'Writer A' : 'Writer B';
      expect((await detailOf('f17-tour-1')).title).toBe(winner);
    });

    it('lưu tab con đẩy version — form Details mở trước đó bị từ chối', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await faqsPolicies(tourId(1), {
        id: tourId(1),
        version: before.version,
        faqs: [],
        policies: [],
      });

      const res = await details(tourId(1), detailsPayload(before, { title: 'Late' }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_TOUR' });
    });

    it('id không có thì 404 NOT_FOUND — mã ấy chỉ còn nghĩa "tour không còn"', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await details(MISSING, detailsPayload(before, { id: MISSING }));

      // Khớp cả mã lẫn câu của contract — 404 trần thì một route chưa tồn tại
      // cũng trả được, ca này sẽ xanh giả.
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Tour not found' });
    });

    it('gắn danh mục hay thêm điểm đến vừa bị xoá thì 404 LINK_NOT_FOUND, rollback trọn (review S1)', async () => {
      // Tour vẫn còn nên mã phải KHÁC `NOT_FOUND`: khu sửa tour coi `NOT_FOUND` là tour đã mất,
      // đá về /tours và vứt chữ chưa lưu.
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      const gone = await deletedLinks();

      const noCategory = await details(
        tourId(1),
        detailsPayload(before, { categoryId: gone.categoryId, title: 'X' }),
      );
      const noDestination = await details(
        tourId(1),
        detailsPayload(before, {
          title: 'Y',
          destinations: [
            { destinationId: DEST_1, isPrimary: true },
            { destinationId: gone.destinationId, isPrimary: false },
          ],
        }),
      );

      for (const res of [noCategory, noDestination]) {
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject(LINK_GONE);
      }
      const after = await detailOf('f17-tour-1');
      expect(after.title).toBe(before.title);
      expect(after.version).toBe(before.version);
      expect(after.destinations).toEqual(before.destinations);
    });

    it('thay nguyên danh sách điểm đến, điểm chính đứng đầu', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      await details(
        tourId(1),
        detailsPayload(before, {
          destinations: [
            { destinationId: DEST_3, isPrimary: false },
            { destinationId: DEST_2, isPrimary: true },
          ],
        }),
      );

      expect((await detailOf('f17-tour-1')).destinations).toEqual([
        { destinationId: DEST_2, isPrimary: true },
        { destinationId: DEST_3, isPrimary: false },
      ]);
    });

    it('số ngày khoá khi có chuyến, KỂ CẢ chuyến đã huỷ; giữ nguyên số ngày thì qua', async () => {
      await makeTour(1);
      await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31), status: 'CANCELLED' });
      const before = await detailOf('f17-tour-1');

      const changed = await details(tourId(1), detailsPayload(before, { durationDays: 3 }));
      const same = await details(tourId(1), detailsPayload(before, { title: 'Same days' }));

      expect(changed.statusCode).toBe(409);
      expect(changed.json()).toMatchObject({ code: 'DURATION_LOCKED' });
      expect(same.statusCode).toBe(200);
    });

    it('số khách không hạ dưới ghế của chuyến chưa về; chuyến đã về hay đã huỷ không khoá', async () => {
      await makeTour(1, { maxGroupSize: 40 });
      await makeDeparture(tourId(1), { startDate: day(-10), endDate: day(-9), seatsTotal: 30 });
      await makeDeparture(tourId(1), {
        startDate: day(20),
        endDate: day(21),
        seatsTotal: 40,
        status: 'CANCELLED',
      });
      await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31), seatsTotal: 12 });
      const before = await detailOf('f17-tour-1');

      const below = await details(tourId(1), detailsPayload(before, { maxGroupSize: 11 }));
      const atFloor = await details(tourId(1), detailsPayload(before, { maxGroupSize: 12 }));

      expect(below.statusCode).toBe(409);
      expect(below.json()).toMatchObject({ code: 'GROUP_SIZE_BELOW_SEATS' });
      expect(atFloor.statusCode).toBe(200);
    });

    it('dữ liệu đã lệch (chuyến nhiều ghế hơn số khách) vẫn lưu được — sàn chỉ chặn khi HẠ', async () => {
      // Spec §2b.2 "tăng thì luôn được" (vòng review F17): chặn cả khi giữ
      // nguyên thì một chuyến 20 ghế trên tour 12 khách khoá cứng tab Details,
      // kể cả lúc chỉ sửa tên hay nâng số khách lên cho khớp.
      await makeTour(1, { maxGroupSize: 12 });
      await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31), seatsTotal: 20 });
      const before = await detailOf('f17-tour-1');

      const kept = await details(tourId(1), detailsPayload(before, { title: 'Renamed' }));
      expect(kept.statusCode).toBe(200);
      const raised = await details(
        tourId(1),
        detailsPayload(AdminTourDetailSchema.parse(kept.json()), { maxGroupSize: 15 }),
      );
      expect(raised.statusCode).toBe(200);
      const lowered = await details(
        tourId(1),
        detailsPayload(AdminTourDetailSchema.parse(raised.json()), { maxGroupSize: 14 }),
      );
      expect(lowered.statusCode).toBe(409);
      expect(lowered.json()).toMatchObject({ code: 'GROUP_SIZE_BELOW_SEATS' });
    });

    it('GIẢM số ngày khi đã có chuyến cũng bị khoá, không chỉ tăng', async () => {
      await makeTour(1);
      await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31) });
      const before = await detailOf('f17-tour-1');

      const shorter = await details(tourId(1), detailsPayload(before, { durationDays: 1 }));

      expect(shorter.statusCode).toBe(409);
      expect(shorter.json()).toMatchObject({ code: 'DURATION_LOCKED' });
      expect((await detailOf('f17-tour-1')).itinerary).toHaveLength(2);
    });

    it('đổi số khách thì tính lại giá vốn; giữ nguyên số khách thì không đụng', async () => {
      await makeTour(1, {
        maxGroupSize: 20,
        costPrice: '99.99',
        costItems: {
          create: [
            { category: 'MEALS', label: 'Lunch', amount: '30.00', basis: 'PER_PERSON' },
            { category: 'TRANSPORT', label: 'Bus', amount: '400.00', basis: 'PER_DEPARTURE' },
          ],
        },
      });
      const before = await detailOf('f17-tour-1');

      const same = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(before, { title: 'No size change' }))).json(),
      );
      const resized = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(same, { maxGroupSize: 10 }))).json(),
      );

      expect(same.costPrice).toBe('99.99');
      // 30.00 + 400.00 / 10
      expect(resized.costPrice).toBe('70.00');
    });

    it('giảm số ngày (chưa có chuyến) xoá các ngày lịch trình thừa trong cùng lệnh', async () => {
      await makeTour(1, {
        isPublished: false,
        durationDays: 4,
        itinerary: {
          create: [1, 2, 3, 4].map((dayNumber) => ({ dayNumber, title: `Day ${dayNumber}` })),
        },
      });
      const before = await detailOf('f17-tour-1');

      const after = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(before, { durationDays: 2 }))).json(),
      );

      expect(after.itinerary.map((d) => d.dayNumber)).toEqual([1, 2]);
      expect(after.readiness.missingDays).toEqual([]);
    });

    it('tour đang bán: tăng số ngày hay xoá tóm tắt bị từ chối và rollback trọn', async () => {
      await makeTour(1); // đang bán, đủ 2 ngày
      const before = await detailOf('f17-tour-1');

      const moreDays = await details(tourId(1), detailsPayload(before, { durationDays: 3 }));
      const noSummary = await details(tourId(1), detailsPayload(before, { summary: '' }));

      for (const res of [moreDays, noSummary]) {
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ code: 'TOUR_NOT_READY' });
      }
      const after = await detailOf('f17-tour-1');
      expect(after.durationDays).toBe(2);
      expect(after.summary).toBe('A day on the water.');
      expect(after.version).toBe(before.version);
    });

    it('tour TẮT bán: làm thiếu vẫn lưu được, readiness nói ra chỗ thiếu', async () => {
      await makeTour(1, { isPublished: false });
      const before = await detailOf('f17-tour-1');

      const res = await details(
        tourId(1),
        detailsPayload(before, { durationDays: 3, summary: null }),
      );

      expect(res.statusCode).toBe(200);
      expect(AdminTourDetailSchema.parse(res.json()).readiness).toEqual({
        summary: false,
        primaryDestination: true,
        missingDays: [3],
        cover: true,
        ready: false,
      });
    });
  });

  describe('setItinerary', () => {
    it('thay nguyên lịch trình và đẩy version', async () => {
      await makeTour(1, { durationDays: 3, isPublished: false });
      const before = await detailOf('f17-tour-1');

      const res = await itinerary(tourId(1), {
        id: tourId(1),
        version: before.version,
        days: [
          { dayNumber: 3, title: 'Home', description: null },
          { dayNumber: 1, title: 'Arrive', description: '09:00 — Pick-up at your hotel' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const after = AdminTourDetailSchema.parse(res.json());
      expect(after.itinerary).toEqual([
        { dayNumber: 1, title: 'Arrive', description: '09:00 — Pick-up at your hotel' },
        { dayNumber: 3, title: 'Home', description: null },
      ]);
      expect(after.readiness.missingDays).toEqual([2]);
      expect(after.version).not.toBe(before.version);
    });

    it('ngày vượt số ngày thì 400 và không đổi gì', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await itinerary(tourId(1), {
        id: tourId(1),
        version: before.version,
        days: [{ dayNumber: 3, title: 'Too far', description: null }],
      });

      expect(res.statusCode).toBe(400);
      const after = await detailOf('f17-tour-1');
      expect(after.itinerary).toHaveLength(2);
      expect(after.version).toBe(before.version);
    });

    it('tour đang bán mà bỏ trống một ngày thì 409 TOUR_NOT_READY', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await itinerary(tourId(1), {
        id: tourId(1),
        version: before.version,
        days: [{ dayNumber: 1, title: 'Only one', description: null }],
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'TOUR_NOT_READY' });
      expect((await detailOf('f17-tour-1')).itinerary).toHaveLength(2);
    });

    it('tour đang bán mà đã mất ảnh bìa thì lệnh sửa bị TOUR_NOT_READY, nói đúng chỗ thiếu', async () => {
      await makeTour(1);
      await prisma.mediaAsset.deleteMany({ where: { ownerId: tourId(1) } });
      const before = await detailOf('f17-tour-1');

      const res = await itinerary(before.id, {
        id: before.id,
        version: before.version,
        days: before.itinerary,
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        code: 'TOUR_NOT_READY',
        message: 'This tour is missing: a cover photo.',
      });
    });

    it('version cũ thì 409 STALE_TOUR', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'Moved on' }));

      const res = await itinerary(tourId(1), { id: tourId(1), version: before.version, days: [] });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_TOUR' });
    });

    it('id không có thì 404', async () => {
      const res = await itinerary(MISSING, {
        id: MISSING,
        version: new Date().toISOString(),
        days: [],
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('setFaqsPolicies', () => {
    it('thay nguyên hai danh sách, giữ ĐÚNG thứ tự gửi', async () => {
      await makeTour(1, {
        faqs: { create: [{ question: 'Old?', answer: 'Gone' }] },
        // Có sẵn một chính sách cũ: bỏ `deleteMany` của chính sách thì nó còn lại.
        policies: { create: [{ kind: 'BOOKING', title: 'Old policy', body: 'Old body' }] },
      });
      const before = await detailOf('f17-tour-1');

      const res = await faqsPolicies(tourId(1), {
        id: tourId(1),
        version: before.version,
        faqs: [
          { question: 'Zebra?', answer: 'Z' },
          { question: 'Alpha?', answer: 'A' },
        ],
        policies: [
          { kind: 'GENERAL', title: 'Weather', body: 'We sail when it is safe.' },
          { kind: 'BOOKING', title: 'Deposit', body: 'Pay in full to book.' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const after = AdminTourDetailSchema.parse(res.json());
      // Thứ tự cố ý NGƯỢC bảng chữ cái — một bản lỡ tay sắp theo chữ sẽ đỏ.
      // So NGUYÊN từng dòng: ghi cứng `kind`, `answer` hay `body` cũng đỏ.
      expect(after.faqs).toEqual([
        { question: 'Zebra?', answer: 'Z' },
        { question: 'Alpha?', answer: 'A' },
      ]);
      expect(after.policies).toEqual([
        { kind: 'GENERAL', title: 'Weather', body: 'We sail when it is safe.' },
        { kind: 'BOOKING', title: 'Deposit', body: 'Pay in full to book.' },
      ]);
    });

    it('version cũ thì 409 STALE_TOUR, không đổi gì; id không có thì 404', async () => {
      await makeTour(1, { faqs: { create: [{ question: 'Kept?', answer: 'Yes' }] } });
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'Moved on' }));

      const stale = await faqsPolicies(tourId(1), {
        id: tourId(1),
        version: before.version,
        faqs: [],
        policies: [],
      });
      const missing = await faqsPolicies(MISSING, {
        id: MISSING,
        version: before.version,
        faqs: [],
        policies: [],
      });

      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toMatchObject({ code: 'STALE_TOUR' });
      expect((await detailOf('f17-tour-1')).faqs).toEqual([{ question: 'Kept?', answer: 'Yes' }]);
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('hai danh sách rỗng là hợp lệ', async () => {
      await makeTour(1, { faqs: { create: [{ question: 'Q?', answer: 'A' }] } });
      const before = await detailOf('f17-tour-1');

      const res = await faqsPolicies(tourId(1), {
        id: tourId(1),
        version: before.version,
        faqs: [],
        policies: [],
      });

      expect(res.statusCode).toBe(200);
      expect(AdminTourDetailSchema.parse(res.json()).faqs).toEqual([]);
    });
  });

  describe('setCosts', () => {
    it('thay nguyên dòng chi phí theo thứ tự gửi và tính lại giá vốn', async () => {
      await makeTour(1, {
        maxGroupSize: 12,
        // Dòng cũ phải biến mất: `costPrice` tính từ input nên chỉ nhìn nó thì
        // bỏ `deleteMany` vẫn xanh.
        costItems: {
          create: [{ category: 'GUIDE', label: 'Old guide', amount: '50.00', basis: 'PER_PERSON' }],
        },
      });
      const before = await detailOf('f17-tour-1');

      const res = await costs(tourId(1), {
        id: tourId(1),
        version: before.version,
        items: [
          { category: 'TRANSPORT', label: 'Boat', amount: '100.01', basis: 'PER_DEPARTURE' },
          { category: 'MEALS', label: 'Lunch', amount: '8.50', basis: 'PER_PERSON' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const after = AdminTourDetailSchema.parse(res.json());
      expect(after.costItems).toEqual([
        { category: 'TRANSPORT', label: 'Boat', amount: '100.01', basis: 'PER_DEPARTURE' },
        { category: 'MEALS', label: 'Lunch', amount: '8.50', basis: 'PER_PERSON' },
      ]);
      // 8.50 + 100.01 / 12 = 8.50 + 8.33 (8.334…) = 16.83
      expect(after.costPrice).toBe('16.83');
    });

    it('xoá hết dòng chi phí thì giá vốn về null — tour chưa khai giá vốn', async () => {
      await makeTour(1, {
        costPrice: '10.00',
        costItems: {
          create: [{ category: 'MEALS', label: 'Lunch', amount: '10.00', basis: 'PER_PERSON' }],
        },
      });
      const before = await detailOf('f17-tour-1');

      const res = await costs(tourId(1), { id: tourId(1), version: before.version, items: [] });

      expect(AdminTourDetailSchema.parse(res.json()).costPrice).toBeNull();
    });

    it('version cũ thì 409 STALE_TOUR, không đổi gì; id không có thì 404', async () => {
      await makeTour(1, {
        costPrice: '10.00',
        costItems: {
          create: [{ category: 'MEALS', label: 'Lunch', amount: '10.00', basis: 'PER_PERSON' }],
        },
      });
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'Moved on' }));

      const stale = await costs(tourId(1), { id: tourId(1), version: before.version, items: [] });
      const missing = await costs(MISSING, { id: MISSING, version: before.version, items: [] });

      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toMatchObject({ code: 'STALE_TOUR' });
      const after = await detailOf('f17-tour-1');
      expect(after.costItems).toHaveLength(1);
      expect(after.costPrice).toBe('10.00');
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('signPhotoUploads (F18)', () => {
    it('ký đúng count bộ trong thư mục của tour, publicId khác nhau, cả lô vào hàng dọn', async () => {
      await makeTour(1);

      const res = await signUploads(tourId(1), { id: tourId(1), count: 3 });

      expect(res.statusCode).toBe(200);
      const params = SignedUploadParamsSchema.array().parse(res.json());
      expect(params).toHaveLength(3);
      expect(new Set(params.map((p) => p.publicId)).size).toBe(3);
      for (const p of params) {
        expect(p.folder).toBe(`tourism/tours/${tourId(1)}`);
        expect(p.overwrite).toBe(false);
        expect(p.transformation).toBe('c_limit,w_2400,h_2400,fl_force_strip');
      }
      // Ký là đăng ký theo dõi (ADR-0035 §3): publicId ĐẦY ĐỦ `<folder>/<basename>`.
      const queued = await prisma.mediaGarbage.findMany({ select: { publicId: true } });
      expect(queued.map((q) => q.publicId).sort()).toEqual(
        params.map((p) => `${p.folder}/${p.publicId}`).sort(),
      );
    });

    it('tour không có thì 404 và không ký gì; count ngoài 1..30 thì 400', async () => {
      const missing = await signUploads(MISSING, { id: MISSING, count: 1 });
      expect(missing.statusCode).toBe(404);
      expect(await prisma.mediaGarbage.count()).toBe(0);

      await makeTour(1);
      expect((await signUploads(tourId(1), { id: tourId(1), count: 31 })).statusCode).toBe(400);
      expect((await signUploads(tourId(1), { id: tourId(1), count: 0 })).statusCode).toBe(400);
    });
  });

  describe('photoLibrary (F18)', () => {
    it('ảnh của mọi địa danh CÓ ảnh, theo tên; ảnh bìa đầu; địa danh ẩn vẫn có', async () => {
      const asset = (
        ownerId: string,
        publicId: string,
        patch: Partial<Prisma.MediaAssetUncheckedCreateInput> = {},
      ) => ({
        ownerType: 'DESTINATION' as const,
        ownerId,
        publicId,
        type: 'IMAGE' as const,
        role: 'gallery' as const,
        alt: publicId,
        ...patch,
      });
      await prisma.mediaAsset.createMany({
        data: [
          asset(DEST_1, 'tourism/catalog/destination/hoi-an/2', { sortOrder: 2 }),
          asset(DEST_1, 'tourism/catalog/destination/hoi-an/1', {
            sortOrder: 1,
            author: 'J. Nguyen',
            license: 'CC BY-SA 4.0',
          }),
          asset(DEST_1, 'tourism/catalog/destination/hoi-an/hero', { role: 'hero', sortOrder: 5 }),
          // An Bàng đang ẩn — ảnh của nó vẫn hợp lệ cho tour.
          asset(DEST_3, 'tourism/catalog/destination/an-bang/1', { sortOrder: 1 }),
          // Ảnh của TOUR không thuộc thư viện.
          {
            ...asset(tourId(9), 'tourism/catalog/tour/somewhere'),
            ownerType: 'TOUR' as const,
          },
        ],
      });

      const res = await library();

      expect(res.statusCode).toBe(200);
      const groups = AdminPhotoLibrarySchema.parse(res.json());
      // Hà Nội (DEST_2) không có ảnh nên vắng mặt.
      expect(groups.map((g) => g.destination.name)).toEqual(['An Bàng', 'Hội An']);
      expect(groups[1]?.photos.map((p) => p.publicId)).toEqual([
        'tourism/catalog/destination/hoi-an/hero',
        'tourism/catalog/destination/hoi-an/1',
        'tourism/catalog/destination/hoi-an/2',
      ]);
      expect(groups[1]?.photos[1]).toMatchObject({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' });
    });

    it('chỉ bày ẢNH: video của địa danh vắng mặt; địa danh chỉ có video thì vắng cả nhóm (G13)', async () => {
      await prisma.mediaAsset.createMany({
        data: [
          {
            ownerType: 'DESTINATION',
            ownerId: DEST_1,
            publicId: 'tourism/catalog/destination/hoi-an/1',
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 1,
            alt: 'Lanterns',
          },
          {
            ownerType: 'DESTINATION',
            ownerId: DEST_1,
            publicId: 'tourism/catalog/destination/hoi-an/clip',
            type: 'VIDEO',
            role: 'gallery',
            sortOrder: 2,
            alt: 'River clip',
          },
          {
            ownerType: 'DESTINATION',
            ownerId: DEST_3,
            publicId: 'tourism/catalog/destination/an-bang/clip',
            type: 'VIDEO',
            role: 'hero',
            sortOrder: 0,
            alt: 'Beach clip',
          },
        ],
      });

      const groups = AdminPhotoLibrarySchema.parse((await library()).json());

      expect(groups.map((g) => g.destination.name)).toEqual(['Hội An']);
      expect(groups[0]?.photos.map((p) => p.publicId)).toEqual([
        'tourism/catalog/destination/hoi-an/1',
      ]);
    });
  });

  describe('setPhotos (F18)', () => {
    it('lưu đủ ba nguồn theo thứ tự gửi; ảnh đầu là bìa; bust sau commit', async () => {
      await makeTour(1);
      await makeLibrary();
      const before = await detailOf('f17-tour-1');
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [
          { publicId: mine(1, 'new'), alt: 'Our own boat', upload: UPLOAD_META },
          // `author` gửi kèm bị Zod bỏ — ghi công chỉ đến từ dòng thư viện.
          { publicId: LIB_1, alt: 'Lanterns, our words', author: 'Someone else' },
          { publicId: 'tourism/catalog/tour/f17-1', alt: 'The old cover' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const detail = AdminTourDetailSchema.parse(res.json());
      expect(detail.version > before.version).toBe(true);
      expect(detail.photos.map((p) => [p.publicId, p.source])).toEqual([
        [mine(1, 'new'), 'UPLOAD'],
        [LIB_1, 'LIBRARY'],
        // Ảnh bìa gốc giữ lại được, nhưng nhãn nói thật: gỡ ra là không gắn lại được.
        ['tourism/catalog/tour/f17-1', 'CATALOG'],
      ]);
      const rows = await tourPhotoRows(1);
      expect(rows.map((r) => [r.publicId, r.role, r.sortOrder, r.alt])).toEqual([
        [mine(1, 'new'), 'hero', 0, 'Our own boat'],
        [LIB_1, 'gallery', 1, 'Lanterns, our words'],
        ['tourism/catalog/tour/f17-1', 'gallery', 2, 'The old cover'],
      ]);
      expect(rows[0]).toMatchObject({ version: '1759000000', width: 2000, author: null });
      expect(rows[1]).toMatchObject({
        version: '1600000001',
        author: 'J. Nguyen',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lanterns.jpg',
      });
      expect(rows[2]).toMatchObject({ version: '1700000000' });
      expect(revalidate).toHaveBeenCalledWith(['tours', 'tour:f17-tour-1']);
    });

    it.each([
      ['thư mục tải lên của tour khác', { publicId: mine(2, 'x'), alt: 'x', upload: UPLOAD_META }],
      ['thư mục avatar', { publicId: 'tourism/avatars/u-1/x', alt: 'x', upload: UPLOAD_META }],
      ['chuỗi bịa', { publicId: 'somewhere/else', alt: 'x' }],
      ['ảnh tải lên thiếu metadata', { publicId: mine(1, 'no-meta'), alt: 'x' }],
    ])('%s → 400 PHOTO_NOT_ALLOWED, không đổi gì, không bust', async (_name, photo) => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [photo],
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'PHOTO_NOT_ALLOWED' });
      expect(revalidate).not.toHaveBeenCalled();
      const after = await detailOf('f17-tour-1');
      expect(after.version).toBe(before.version);
      expect(after.photos.map((p) => p.publicId)).toEqual(['tourism/catalog/tour/f17-1']);
    });

    it('publicId chỉ có dòng VIDEO của địa danh → 400 PHOTO_NOT_ALLOWED, không đổi gì (G13)', async () => {
      await makeTour(1);
      await prisma.mediaAsset.create({
        data: {
          ownerType: 'DESTINATION',
          ownerId: DEST_1,
          publicId: 'tourism/catalog/destination/hoi-an/clip',
          type: 'VIDEO',
          role: 'gallery',
          sortOrder: 1,
          alt: 'River clip',
        },
      });
      const before = await detailOf('f17-tour-1');

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [
          { publicId: 'tourism/catalog/tour/f17-1', alt: 'Cover' },
          { publicId: 'tourism/catalog/destination/hoi-an/clip', alt: 'River clip' },
        ],
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'PHOTO_NOT_ALLOWED' });
      expect(await tourPhotoRows(1)).toHaveLength(1);
    });

    it('metadata vượt INT4 của cột → 400 BAD_REQUEST, không phải 500 của DB (G12)', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [
          { publicId: 'tourism/catalog/tour/f17-1', alt: 'Cover' },
          { publicId: mine(1, 'huge'), alt: 'x', upload: { ...UPLOAD_META, width: 2_147_483_648 } },
        ],
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'BAD_REQUEST' });
      expect(await tourPhotoRows(1)).toHaveLength(1);
    });

    it('version cũ → 409 STALE_TOUR; id không có → 404', async () => {
      await makeTour(1);
      const stale = await photosWrite(tourId(1), {
        id: tourId(1),
        version: '2020-01-01T00:00:00.000Z',
        photos: [],
      });
      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toMatchObject({ code: 'STALE_TOUR' });

      const missing = await photosWrite(MISSING, {
        id: MISSING,
        version: '2020-01-01T00:00:00.000Z',
        photos: [],
      });
      expect(missing.statusCode).toBe(404);
    });

    it('tour ĐANG bán gỡ hết ảnh → 409 TOUR_NOT_READY, rollback trọn', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [],
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        code: 'TOUR_NOT_READY',
        message: 'This tour is missing: a cover photo.',
      });
      expect(await tourPhotoRows(1)).toHaveLength(1);
      expect((await detailOf('f17-tour-1')).version).toBe(before.version);
    });

    it('lệnh hỏng SAU khi đã gỡ ảnh tải lên → hàng dọn không giữ dấu vết (requeue cùng transaction)', async () => {
      await makeTour(1);
      await prisma.mediaAsset.create({
        data: {
          ownerType: 'TOUR',
          ownerId: tourId(1),
          publicId: mine(1, 'old'),
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 1,
          alt: 'Old upload',
        },
      });
      const before = await detailOf('f17-tour-1');

      // Tour đang bán gỡ hết ảnh: `requeue` chạy TRƯỚC `assertStillReady`, rồi cả
      // lệnh rollback — requeue ngoài transaction thì ảnh vẫn nằm trong hàng dọn và
      // bảy ngày sau bị destroy dù tour còn dùng (ADR-0035 §7).
      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [],
      });

      expect(res.statusCode).toBe(409);
      expect(await prisma.mediaGarbage.count()).toBe(0);
      expect(await tourPhotoRows(1)).toHaveLength(2);
    });

    it('tour TẮT bán gỡ hết ảnh được; readiness nói thiếu ảnh bìa', async () => {
      await makeTour(1, { isPublished: false });
      const before = await detailOf('f17-tour-1');

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [],
      });

      expect(res.statusCode).toBe(200);
      const detail = AdminTourDetailSchema.parse(res.json());
      expect(detail.photos).toEqual([]);
      expect(detail.readiness.cover).toBe(false);
    });

    it('gỡ ảnh tải lên → vào lại hàng dọn với đồng hồ mới; gỡ ảnh thư viện → không', async () => {
      await makeTour(1);
      await makeLibrary();
      await prisma.mediaAsset.createMany({
        data: [
          {
            ownerType: 'TOUR',
            ownerId: tourId(1),
            publicId: mine(1, 'old'),
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 1,
            alt: 'Old upload',
          },
          {
            ownerType: 'TOUR',
            ownerId: tourId(1),
            publicId: LIB_1,
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 2,
            alt: 'Borrowed',
          },
        ],
      });
      // Đồng hồ cũ: ký từ mười ngày trước (ADR-0035 §3).
      const signedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await prisma.mediaGarbage.create({ data: { publicId: mine(1, 'old'), createdAt: signedAt } });
      const before = await detailOf('f17-tour-1');

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [{ publicId: 'tourism/catalog/tour/f17-1', alt: 'Cover' }],
      });

      expect(res.statusCode).toBe(200);
      const queued = await prisma.mediaGarbage.findMany();
      expect(queued.map((q) => q.publicId)).toEqual([mine(1, 'old')]);
      expect(queued[0]?.createdAt.getTime()).toBeGreaterThan(signedAt.getTime());
    });

    it('schema: trùng publicId và 31 ảnh đều 400', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      const cover = { publicId: 'tourism/catalog/tour/f17-1', alt: 'Cover' };

      const dup = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [cover, cover],
      });
      expect(dup.statusCode).toBe(400);

      // 31 ảnh HỢP LỆ từng cái (ảnh tải lên đúng thư mục của tour, có metadata): chỉ
      // trần `.max(30)` của schema chặn được — ảnh `lib/…` không nguồn nào nhận cũng ra
      // 400 (PHOTO_NOT_ALLOWED) nên từng làm ca này xanh giả (vòng review F18).
      const tooMany = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: Array.from({ length: 31 }, (_, i) => ({
          publicId: mine(1, `p${i}`),
          alt: 'x',
          upload: UPLOAD_META,
        })),
      });
      expect(tooMany.statusCode).toBe(400);
      expect(tooMany.json()).toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  describe('bust cache web của bốn lệnh sửa', () => {
    it('mỗi lệnh bust đúng hai tag của tour, SAU commit của CHÍNH lệnh ấy', async () => {
      await makeTour(1, { isPublished: false });
      // Kết nối khác đọc phiên bản lúc bust: bust nằm TRONG transaction thì nó
      // còn thấy phiên bản cũ. Bản trước đọc `title` — chỉ lệnh đầu đổi title,
      // nên dời bust của ba lệnh sau vào transaction vẫn xanh (vòng review F17).
      const seen: Array<{ tags: string[]; version: string | undefined }> = [];
      vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        const row = await prisma.tour.findUnique({ where: { id: tourId(1) } });
        seen.push({ tags, version: row?.updatedAt.toISOString() });
      });
      let current = await detailOf('f17-tour-1');
      const saves = [
        () => details(tourId(1), detailsPayload(current, { title: 'Fresh' })),
        () => itinerary(tourId(1), { id: tourId(1), version: current.version, days: [] }),
        () =>
          faqsPolicies(tourId(1), {
            id: tourId(1),
            version: current.version,
            faqs: [],
            policies: [],
          }),
        () => costs(tourId(1), { id: tourId(1), version: current.version, items: [] }),
      ];

      for (const [index, save] of saves.entries()) {
        current = AdminTourDetailSchema.parse((await save()).json());
        // Chờ lượt bust của lệnh NÀY đọc xong rồi mới bắn lệnh kế.
        await vi.waitFor(() => expect(seen).toHaveLength(index + 1));
        expect(seen[index]).toEqual({
          tags: ['tours', 'tour:f17-tour-1'],
          version: current.version,
        });
      }
    });

    it('lệnh hỏng thì không bust', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'Moved on' }));
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await details(tourId(1), detailsPayload(before, { title: 'Stale' }));
      await itinerary(tourId(1), { id: tourId(1), version: before.version, days: [] });
      await faqsPolicies(tourId(1), {
        id: tourId(1),
        version: before.version,
        faqs: [],
        policies: [],
      });
      await costs(tourId(1), { id: tourId(1), version: before.version, items: [] });
      // Rollback vì TOUR_NOT_READY (tour đang bán bỏ trống ngày 2) cũng không bust.
      const fresh = await detailOf('f17-tour-1');
      const notReady = await itinerary(tourId(1), {
        id: tourId(1),
        version: fresh.version,
        days: [{ dayNumber: 1, title: 'Only one', description: null }],
      });

      expect(notReady.json()).toMatchObject({ code: 'TOUR_NOT_READY' });
      expect(revalidate).not.toHaveBeenCalled();
    });
  });
});
