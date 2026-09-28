import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminTourCreateResultSchema,
  AdminTourDeleteResultSchema,
  type AdminTourDetail,
  AdminTourDetailSchema,
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

  /** Một tour ĐỦ để bán, 2 ngày, đang bán — ca nào cần khác thì đè bằng `patch`. */
  const makeTour = (n: number, patch: Partial<Prisma.TourUncheckedCreateInput> = {}) =>
    prisma.tour.create({
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

    it('danh mục hay điểm đến không tồn tại thì 404 NOT_FOUND, không để lại hàng nào', async () => {
      const noCategory = await create({ ...CREATE, categoryId: MISSING });
      const noDestination = await create({
        ...CREATE,
        slug: 'other-slug',
        primaryDestinationId: MISSING,
      });

      expect(noCategory.statusCode).toBe(404);
      expect(noCategory.json()).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Category or destination not found',
      });
      expect(noDestination.statusCode).toBe(404);
      expect(noDestination.json()).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Category or destination not found',
      });
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

    it('id không có thì 404; danh mục không có thì 404 và rollback trọn', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const noTour = await details(MISSING, detailsPayload(before, { id: MISSING }));
      const noCategory = await details(
        tourId(1),
        detailsPayload(before, { categoryId: MISSING, title: 'X' }),
      );

      // Khớp cả mã lẫn câu của contract — 404 trần thì một route chưa tồn tại
      // cũng trả được, ca này sẽ xanh giả.
      for (const res of [noTour, noCategory]) {
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({
          code: 'NOT_FOUND',
          message: 'Tour, category or destination not found',
        });
      }
      const after = await detailOf('f17-tour-1');
      expect(after.title).toBe(before.title);
      expect(after.version).toBe(before.version);
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

    it('version cũ thì 409 STALE_TOUR', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'Moved on' }));

      const res = await itinerary(tourId(1), { id: tourId(1), version: before.version, days: [] });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_TOUR' });
    });
  });

  describe('setFaqsPolicies', () => {
    it('thay nguyên hai danh sách, giữ ĐÚNG thứ tự gửi', async () => {
      await makeTour(1, { faqs: { create: [{ question: 'Old?', answer: 'Gone' }] } });
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
      expect(after.faqs.map((f) => f.question)).toEqual(['Zebra?', 'Alpha?']);
      expect(after.policies.map((p) => p.title)).toEqual(['Weather', 'Deposit']);
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
      await makeTour(1, { maxGroupSize: 12 });
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
      expect(after.costItems.map((c) => c.label)).toEqual(['Boat', 'Lunch']);
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
  });

  describe('bust cache web của bốn lệnh sửa', () => {
    it('mỗi lệnh bust đúng hai tag của tour, SAU commit', async () => {
      await makeTour(1, { isPublished: false });
      const seen: Array<{ tags: string[]; title: string | undefined }> = [];
      vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        const row = await prisma.tour.findUnique({ where: { id: tourId(1) } });
        seen.push({ tags, title: row?.title });
      });
      let current = await detailOf('f17-tour-1');

      current = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(current, { title: 'Fresh' }))).json(),
      );
      current = AdminTourDetailSchema.parse(
        (await itinerary(tourId(1), { id: tourId(1), version: current.version, days: [] })).json(),
      );
      current = AdminTourDetailSchema.parse(
        (
          await faqsPolicies(tourId(1), {
            id: tourId(1),
            version: current.version,
            faqs: [],
            policies: [],
          })
        ).json(),
      );
      await costs(tourId(1), { id: tourId(1), version: current.version, items: [] });

      await vi.waitFor(() => expect(seen).toHaveLength(4));
      for (const call of seen) {
        expect(call).toEqual({ tags: ['tours', 'tour:f17-tour-1'], title: 'Fresh' });
      }
    });

    it('lệnh hỏng thì không bust', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'Moved on' }));
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await details(tourId(1), detailsPayload(before, { title: 'Stale' }));
      await itinerary(tourId(1), { id: tourId(1), version: before.version, days: [] });

      expect(revalidate).not.toHaveBeenCalled();
    });
  });
});
