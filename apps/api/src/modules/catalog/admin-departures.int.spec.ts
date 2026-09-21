import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminDepartureRowSchema,
  AdminDeparturesListResultSchema,
  vietnamToday,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  DepartureStatus,
  PaymentProvider,
  TourCostBasis,
  TourCostCategory,
} from '../../generated/prisma/enums.js';
import { calendarDate, startOfDayUtc } from '../../lib/calendar-date.js';

/**
 * Integration (Docker PG, db tourism_test) — bảng chuyến phía admin (spec
 * P4e-1 F12): `list` (một tour, lọc, đếm booking sống), `create` (hai phán
 * quyết ngày + đóng băng giá vốn cố định), `update` (ba phán quyết) và
 * `setStatus` (đóng/mở, chặn mở sau hạn chót).
 *
 * Ba ca đắt nhất, và là lý do bộ này phải chạy trên DB thật:
 *  ① đổi ngày trên chuyến đã có booking sống → 409, dữ liệu KHÔNG đổi;
 *  ② hạ ghế dưới số đã đặt → 409 Ở TẦNG API, không phải 23514 của CHECK;
 *  ③ `status: 'CANCELLED'` gửi thẳng qua HTTP → 400 ngay ở biên schema.
 *
 * Mọi mốc ngày tính từ NGÀY VIỆT NAM hôm nay (ADR-0041 §7) nên bộ test không
 * rung theo múi giờ máy chạy nó.
 */

const PUBLISHED_SLUG = 'hoi-an-lantern-evening';
const OTHER_SLUG = 'hanoi-heritage-day';
const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)
const CUSTOMER_EMAIL = 'departures-customer@tourism.test';

function requireFixtureTour(slug: string) {
  const found = catalog.tours.find((t) => t.slug === slug);
  if (!found) throw new Error(`fixture tour missing: ${slug}`);
  return found;
}

const tour = requireFixtureTour(PUBLISHED_SLUG);
const otherTour = requireFixtureTour(OTHER_SLUG);

const DAY = 86_400_000;
/** Nửa đêm UTC của ngày Việt Nam hôm nay + `offset` ngày — khuôn của cột `@db.Date`. */
const dayAt = (offset: number): Date =>
  new Date(startOfDayUtc(vietnamToday(new Date())).getTime() + offset * DAY);
const dateAt = (offset: number): string => calendarDate(dayAt(offset));

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

describe('admin departures integration (F12)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;

  const depId = (n: number) => `f1200001-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const bookingId = (n: number) => `f1200002-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const MISSING_ID = 'f1200001-0000-4000-8000-999999999999';

  /** Chuyến còn xa: 5 ngày → N = 7 → hạn chót hôm nay + 53. Có khách. */
  const BOOKED = depId(1);
  /** Chuyến còn xa, CHƯA ai đặt — nơi thử đổi ngày. */
  const FREE = depId(2);
  /** Chuyến lịch sử đã đóng. */
  const PAST = depId(3);
  /** Khởi hành HÔM NAY, 1 ngày → N = 1 → hạn chót hôm qua: mở lại không được. */
  const DEADLINE_GONE = depId(4);
  /** Đã huỷ — bản ghi đóng. */
  const CANCELLED = depId(5);
  /** Chuyến của TOUR KHÁC — canh việc `list` không trộn lịch hai tour. */
  const FOREIGN = depId(6);

  function departure(
    id: string,
    row: {
      tourId?: string;
      start: number;
      end: number;
      status?: DepartureStatus;
      seatsTotal?: number;
      seatsBooked?: number;
      priceOverride?: string | null;
    },
  ): Prisma.TourDepartureCreateManyInput {
    return {
      id,
      tourId: row.tourId ?? tour.id,
      startDate: dayAt(row.start),
      endDate: dayAt(row.end),
      seatsTotal: row.seatsTotal ?? 20,
      seatsBooked: row.seatsBooked ?? 0,
      status: row.status ?? DepartureStatus.OPEN,
      priceOverride: row.priceOverride ?? null,
    };
  }

  function booking(
    n: number,
    row: { departureId: string; status: BookingStatus },
  ): Prisma.BookingCreateManyInput {
    return {
      id: bookingId(n),
      code: `BK-DEP0${String(n).padStart(4, '0')}`,
      userId: customerId,
      tourId: tour.id,
      departureId: row.departureId,
      numAdults: 2,
      numChildren: 0,
      totalAmount: '100.00',
      unitPrice: '50.00',
      currency: 'USD',
      status: row.status,
      tourTitle: tour.title,
      departureStartDate: dayAt(60),
      departureEndDate: dayAt(64),
      contactName: 'Ada Lovelace',
      contactEmail: CUSTOMER_EMAIL,
      paymentProvider: PaymentProvider.STRIPE,
    };
  }

  const list = (query: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/admin/departures${query}`, headers: { cookie } });

  const create = (payload: Record<string, unknown>, cookie: string) =>
    app.inject({ method: 'POST', url: '/api/admin/departures', headers: { cookie }, payload });

  const update = (id: string, payload: Record<string, unknown>, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/departures/${id}`,
      headers: { cookie },
      payload,
    });

  const setStatus = (id: string, status: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/departures/${id}/status`,
      headers: { cookie },
      payload: { status },
    });

  const listOk = async (query: string) => {
    const res = await list(query, adminCookie);
    expect(res.statusCode).toBe(200);
    return AdminDeparturesListResultSchema.parse(res.json());
  };

  /** Bốn field sửa được, lấy nguyên từ một hàng đang có — test chỉ đổi thứ nó quan tâm. */
  const editable = (row: {
    startDate: string;
    endDate: string;
    seatsTotal: number;
    priceOverride: string | null;
  }) => ({
    startDate: row.startDate,
    endDate: row.endDate,
    seatsTotal: row.seatsTotal,
    priceOverride: row.priceOverride,
  });

  const rowById = async (id: string) => {
    const paged = await listOk(`?slug=${PUBLISHED_SLUG}&limit=100`);
    const found = paged.items.find((item) => item.id === id);
    if (!found) throw new Error(`departure ${id} not in list`);
    return found;
  };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE tour_categories, destinations, users, tour_departures CASCADE',
    );
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });
    await prisma.destination.createMany({ data: catalog.destinations });
    await prisma.tour.createMany({
      data: [tour, otherTour] as unknown as Prisma.TourCreateManyInput[],
    });
    // Giá vốn của tour: MỘT dòng theo chuyến + MỘT dòng theo khách. `create`
    // phải đóng băng đúng vế theo-chuyến (400.00), không phải tổng hai vế.
    await prisma.tourCostItem.createMany({
      data: [
        {
          id: 'f1200003-0000-4000-8000-000000000001',
          tourId: tour.id,
          category: TourCostCategory.TRANSPORT,
          label: 'Coach for the whole departure',
          amount: '400.00',
          basis: TourCostBasis.PER_DEPARTURE,
          sortOrder: 1,
        },
        {
          id: 'f1200003-0000-4000-8000-000000000002',
          tourId: tour.id,
          category: TourCostCategory.MEALS,
          label: 'Meals per traveller',
          amount: '30.00',
          basis: TourCostBasis.PER_PERSON,
          sortOrder: 2,
        },
      ],
    });

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
    customerId = (await prisma.user.findUniqueOrThrow({ where: { email: CUSTOMER_EMAIL } })).id;
  });

  beforeEach(async () => {
    // Booking trỏ vào chuyến bằng FK RESTRICT — xoá booking TRƯỚC.
    await prisma.booking.deleteMany();
    await prisma.tourDeparture.deleteMany();
    await prisma.tourDeparture.createMany({
      data: [
        departure(BOOKED, { start: 60, end: 64, seatsTotal: 20, seatsBooked: 4 }),
        departure(FREE, { start: 90, end: 92, priceOverride: '99.00' }),
        departure(PAST, { start: -30, end: -28, status: DepartureStatus.CLOSED }),
        departure(DEADLINE_GONE, { start: 0, end: 0, status: DepartureStatus.CLOSED }),
        departure(CANCELLED, { start: 45, end: 47, status: DepartureStatus.CANCELLED }),
        departure(FOREIGN, { start: 70, end: 72, tourId: otherTour.id }),
      ],
    });
    await prisma.booking.createMany({
      data: [
        // Hai booking SỐNG (PAID + PENDING) và một đã đóng sổ trên CÙNG chuyến.
        booking(1, { departureId: BOOKED, status: BookingStatus.PAID }),
        booking(2, { departureId: BOOKED, status: BookingStatus.PENDING }),
        booking(3, { departureId: BOOKED, status: BookingStatus.CANCELLED }),
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('guard', () => {
    it('ẩn danh → 401, khách thường → 403, ở CẢ đường đọc lẫn đường ghi', async () => {
      expect((await list(`?slug=${PUBLISHED_SLUG}`, '')).statusCode).toBe(401);
      expect((await list(`?slug=${PUBLISHED_SLUG}`, customerCookie)).statusCode).toBe(403);
      expect((await setStatus(FREE, 'CLOSED', customerCookie)).statusCode).toBe(403);
    });
  });

  describe('list', () => {
    it('chỉ chuyến của ĐÚNG tour đó, gần nhất trước, kèm chính tour', async () => {
      const paged = await listOk(`?slug=${PUBLISHED_SLUG}&limit=100`);

      // startDate desc: +90, +60, +45, hôm nay, −30. `FOREIGN` (+70) thuộc
      // tour khác nên KHÔNG được chen vào giữa.
      expect(paged.items.map((item) => item.id)).toEqual([
        FREE,
        BOOKED,
        CANCELLED,
        DEADLINE_GONE,
        PAST,
      ]);
      expect(paged.tour.slug).toBe(PUBLISHED_SLUG);
      expect(paged.tour.title).toBe(tour.title);
    });

    it('đếm booking SỐNG, không đếm booking đã đóng sổ', async () => {
      const row = await rowById(BOOKED);

      // PAID + PENDING là sống; CANCELLED thì không.
      expect(row.liveBookingCount).toBe(2);
      // Ghế là con số KHÁC: một booking chở hai khách.
      expect(row.seatsBooked).toBe(4);
    });

    it('chuyến không có booking nào trả 0, không phải vắng mặt', async () => {
      expect((await rowById(FREE)).liveBookingCount).toBe(0);
    });

    it('giá áp dụng = priceOverride ?? basePrice, và hạn chót do server tính', async () => {
      const free = await rowById(FREE);
      const booked = await rowById(BOOKED);

      expect(free.price).toBe('99.00');
      expect(free.priceOverride).toBe('99.00');
      expect(booked.priceOverride).toBeNull();
      expect(booked.price).toBe(tour.basePrice);
      // Chuyến 5 ngày → N = 7 → hạn chót = ngày đi − 7.
      expect(booked.cancellationDeadline).toBe(dateAt(53));
    });

    it('lọc theo trạng thái', async () => {
      const cancelled = await listOk(`?slug=${PUBLISHED_SLUG}&status=CANCELLED`);

      expect(cancelled.items.map((item) => item.id)).toEqual([CANCELLED]);
      expect(cancelled.total).toBe(1);
    });

    it('slug lạ → 404', async () => {
      expect((await list('?slug=khong-co-tour-nay', adminCookie)).statusCode).toBe(404);
    });
  });

  describe('create', () => {
    it('thêm một chuyến, giá để trống thì thừa hưởng basePrice của tour', async () => {
      const res = await create(
        { slug: PUBLISHED_SLUG, startDate: dateAt(120), endDate: dateAt(122), seatsTotal: 12 },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const row = AdminDepartureRowSchema.parse(res.json());
      expect(row.startDate).toBe(dateAt(120));
      expect(row.priceOverride).toBeNull();
      expect(row.price).toBe(tour.basePrice);
      expect(row.status).toBe('OPEN');
      expect(row.seatsBooked).toBe(0);
      expect(row.liveBookingCount).toBe(0);
    });

    it('đóng băng giá vốn CỐ ĐỊNH của chuyến từ các dòng PER_DEPARTURE', async () => {
      // ADR-0033 §3: báo cáo tháng tính vế này MỘT lần cho mỗi chuyến đã chạy.
      // Chuyến tạo tay mà để null là biên lợi nhuận đẹp hơn sự thật.
      const res = await create(
        { slug: PUBLISHED_SLUG, startDate: dateAt(130), endDate: dateAt(131), seatsTotal: 10 },
        adminCookie,
      );
      const row = AdminDepartureRowSchema.parse(res.json());

      const saved = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: row.id } });
      expect(saved.fixedCostAmount?.toFixed(2)).toBe('400.00');
    });

    it('ngày về trước ngày đi → 422, không ghi gì', async () => {
      const res = await create(
        { slug: PUBLISHED_SLUG, startDate: dateAt(50), endDate: dateAt(49), seatsTotal: 10 },
        adminCookie,
      );

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('INVALID_DATE_RANGE');
      expect(await prisma.tourDeparture.count({ where: { startDate: dayAt(50) } })).toBe(0);
    });

    it('ngày đi đã trôi qua → 422', async () => {
      const res = await create(
        { slug: PUBLISHED_SLUG, startDate: dateAt(-1), endDate: dateAt(1), seatsTotal: 10 },
        adminCookie,
      );

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('START_IN_PAST');
    });

    it('khởi hành HÔM NAY vẫn tạo được — biên dưới nằm trong tập cho phép', async () => {
      const res = await create(
        { slug: PUBLISHED_SLUG, startDate: dateAt(0), endDate: dateAt(0), seatsTotal: 10 },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
    });

    it('tour lạ → 404', async () => {
      const res = await create(
        { slug: 'khong-co-tour-nay', startDate: dateAt(10), endDate: dateAt(11), seatsTotal: 10 },
        adminCookie,
      );

      expect(res.statusCode).toBe(404);
    });
  });

  describe('update', () => {
    it('ĐỔI NGÀY trên chuyến đã có booking sống → 409, dữ liệu KHÔNG đổi', async () => {
      const before = await rowById(BOOKED);
      const res = await update(
        BOOKED,
        { ...editable(before), startDate: dateAt(70), endDate: dateAt(74) },
        adminCookie,
      );

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('DEPARTURE_HAS_BOOKINGS');
      // Câu từ chối mang con số thật — admin biết đang vướng mấy khách.
      expect(res.json().message).toContain('2');
      const after = await rowById(BOOKED);
      expect(after.startDate).toBe(before.startDate);
      expect(after.endDate).toBe(before.endDate);
    });

    it('nhưng GIÁ và GHẾ thì vẫn sửa được trên chính chuyến đó', async () => {
      // Khách đã mua không khoá cả hàng lại: thêm ghế vì đổi xe to hơn là
      // việc thường ngày.
      const before = await rowById(BOOKED);
      const res = await update(
        BOOKED,
        { ...editable(before), seatsTotal: 30, priceOverride: '111.00' },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const row = AdminDepartureRowSchema.parse(res.json());
      expect(row.seatsTotal).toBe(30);
      expect(row.price).toBe('111.00');
      expect(row.liveBookingCount).toBe(2);
    });

    it('đổi ngày trên chuyến CHƯA ai đặt → cho đi', async () => {
      const before = await rowById(FREE);
      const res = await update(
        FREE,
        { ...editable(before), startDate: dateAt(95), endDate: dateAt(97) },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      expect(AdminDepartureRowSchema.parse(res.json()).startDate).toBe(dateAt(95));
    });

    it('HẠ GHẾ dưới số đã đặt → 409 ở tầng API, KHÔNG phải 23514 của CHECK', async () => {
      const before = await rowById(BOOKED);
      const res = await update(BOOKED, { ...editable(before), seatsTotal: 3 }, adminCookie);

      // 500 ở đây nghĩa là lỗi ràng buộc đã lọt lên tận màn hình.
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('SEATS_BELOW_BOOKED');
      expect(res.json().message).toContain('4');
      expect((await rowById(BOOKED)).seatsTotal).toBe(20);
    });

    it('hạ ghế xuống ĐÚNG bằng số đã đặt → cho đi', async () => {
      const before = await rowById(BOOKED);
      const res = await update(BOOKED, { ...editable(before), seatsTotal: 4 }, adminCookie);

      expect(res.statusCode).toBe(200);
      expect(AdminDepartureRowSchema.parse(res.json()).seatsTotal).toBe(4);
    });

    it('sửa ghế trên chuyến ĐÃ CHẠY vẫn được, vì ngày không đổi', async () => {
      // Luật "không khởi hành trong quá khứ" chỉ áp khi NGÀY thật sự đổi —
      // nếu không thì mọi chuyến lịch sử sẽ thành bất khả sửa.
      const before = await rowById(PAST);
      const res = await update(PAST, { ...editable(before), seatsTotal: 9 }, adminCookie);

      expect(res.statusCode).toBe(200);
    });

    it('dời một chuyến lịch sử sang ngày quá khứ khác → 422', async () => {
      const before = await rowById(PAST);
      const res = await update(
        PAST,
        { ...editable(before), startDate: dateAt(-20), endDate: dateAt(-18) },
        adminCookie,
      );

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('START_IN_PAST');
    });

    it('chuyến đã HUỶ thì không sửa được nữa', async () => {
      const before = await rowById(CANCELLED);
      const res = await update(CANCELLED, { ...editable(before), seatsTotal: 5 }, adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('DEPARTURE_CANCELLED');
    });

    it('id lạ → 404', async () => {
      const res = await update(
        MISSING_ID,
        { startDate: dateAt(80), endDate: dateAt(82), seatsTotal: 10, priceOverride: null },
        adminCookie,
      );

      expect(res.statusCode).toBe(404);
    });
  });

  describe('setStatus', () => {
    it('đóng rồi mở lại một chuyến còn trong hạn', async () => {
      expect((await setStatus(FREE, 'CLOSED', adminCookie)).statusCode).toBe(200);
      expect((await rowById(FREE)).status).toBe('CLOSED');

      const reopened = await setStatus(FREE, 'OPEN', adminCookie);
      expect(reopened.statusCode).toBe(200);
      expect(AdminDepartureRowSchema.parse(reopened.json()).status).toBe('OPEN');
    });

    it('đóng KHÔNG đụng tới booking nào', async () => {
      await setStatus(BOOKED, 'CLOSED', adminCookie);

      const alive = await prisma.booking.count({
        where: { departureId: BOOKED, status: { in: [BookingStatus.PAID, BookingStatus.PENDING] } },
      });
      expect(alive).toBe(2);
    });

    it('mở lại sau hạn chót → 409, kèm chính ngày hạn chót', async () => {
      const res = await setStatus(DEADLINE_GONE, 'OPEN', adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('DEADLINE_PASSED');
      expect(res.json().message).toContain(dateAt(-1));
      expect((await rowById(DEADLINE_GONE)).status).toBe('CLOSED');
    });

    it('ĐÓNG một chuyến đã quá hạn thì vẫn được — đóng sớm không hứa gì với ai', async () => {
      await prisma.tourDeparture.update({
        where: { id: DEADLINE_GONE },
        data: { status: DepartureStatus.OPEN },
      });

      expect((await setStatus(DEADLINE_GONE, 'CLOSED', adminCookie)).statusCode).toBe(200);
    });

    it('bấm lại đúng trạng thái đang có là NO-OP, không đổi updatedAt', async () => {
      const before = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: FREE } });
      const res = await setStatus(FREE, 'OPEN', adminCookie);
      const after = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: FREE } });

      expect(res.statusCode).toBe(200);
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });

    it('CANCELLED gửi thẳng qua HTTP → 400 ngay ở biên schema', async () => {
      // Cửa hậu nguy hiểm nhất của vùng này: đổi trạng thái sang CANCELLED mà
      // không hoàn một đồng nào cho khách đã trả tiền (đường đúng là F13).
      const res = await setStatus(FREE, 'CANCELLED', adminCookie);

      expect(res.statusCode).toBe(400);
      expect((await rowById(FREE)).status).toBe('OPEN');
    });

    it('chuyến đã HUỶ thì không đổi trạng thái được nữa', async () => {
      const res = await setStatus(CANCELLED, 'OPEN', adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('DEPARTURE_CANCELLED');
    });

    it('id lạ → 404', async () => {
      expect((await setStatus(MISSING_ID, 'CLOSED', adminCookie)).statusCode).toBe(404);
    });
  });
});
