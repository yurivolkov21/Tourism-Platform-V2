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
import type { DepartureRefundJob } from '../../worker/departure-refund.service.js';
import {
  clearDepartureRefundSender,
  registerDepartureRefundSender,
} from '../../worker/departure-refund-queue.js';

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
      // Dưới `max_group_size` của tour fixture (16) — F12 vòng hai thêm trần
      // ghế theo cỡ nhóm tour, nên số mặc định cũ (20) nay là một chuyến không
      // hợp lệ ngay từ lúc dựng.
      seatsTotal: row.seatsTotal ?? 12,
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
      // Có capture thì mới hoàn vào đâu được — `cancellationBlocker` loại
      // booking không có nó, và đường huỷ chuyến của F13 đi qua đúng chốt ấy.
      providerPaymentId: row.status === BookingStatus.PAID ? `pi_dep_${n}` : null,
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

  const cancel = (id: string, reason: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/departures/${id}/cancel`,
      headers: { cookie },
      payload: { reason },
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

  /**
   * Bốn field sửa được + token phiên bản, lấy nguyên từ một hàng đang có —
   * test chỉ đổi thứ nó quan tâm.
   *
   * `version` đi kèm vì mọi lệnh sửa THẬT đều mang nó: form mở từ một hàng,
   * và server so token để phát hiện ghi đè mù. Test nào muốn thử token CŨ thì
   * ghi đè tường minh.
   */
  const editable = (row: {
    startDate: string;
    endDate: string;
    seatsTotal: number;
    priceOverride: string | null;
    version: string;
  }) => ({
    startDate: row.startDate,
    endDate: row.endDate,
    seatsTotal: row.seatsTotal,
    priceOverride: row.priceOverride,
    version: row.version,
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
        departure(BOOKED, { start: 60, end: 64, seatsTotal: 12, seatsBooked: 4 }),
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
    it('ĐỔI NGÀY trên chuyến đã có ghế bị giữ → 409, dữ liệu KHÔNG đổi', async () => {
      const before = await rowById(BOOKED);
      const res = await update(
        BOOKED,
        { ...editable(before), startDate: dateAt(70), endDate: dateAt(74) },
        adminCookie,
      );

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('DEPARTURE_HAS_BOOKINGS');
      // Câu từ chối mang con số thật, và con số ấy là GHẾ (`seats_booked` của
      // chính hàng vừa khoá) chứ không phải số booking: hoàn tiền thiện chí
      // trọn tiền KHÔNG trả ghế, nên đếm theo trạng thái booking sẽ đọc ra 0
      // trên một chuyến vẫn còn khách thật. Chuyến này: 2 booking, 4 ghế.
      expect(res.json().message).toContain('4 seats booked');
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
        { ...editable(before), seatsTotal: 14, priceOverride: '111.00' },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const row = AdminDepartureRowSchema.parse(res.json());
      expect(row.seatsTotal).toBe(14);
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
      expect((await rowById(BOOKED)).seatsTotal).toBe(12);
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
        {
          startDate: dateAt(80),
          endDate: dateAt(82),
          seatsTotal: 10,
          priceOverride: null,
          // Token bịa nhưng ĐÚNG hình dạng: payload hỏng sẽ ra 400 và che mất
          // đúng cái 404 mà ca này muốn đo.
          version: '2026-09-20T08:00:00.000Z',
        },
        adminCookie,
      );

      expect(res.statusCode).toBe(404);
    });

    it('token phiên bản CŨ → 409 DEPARTURE_STALE, và hàng KHÔNG đổi', async () => {
      // Hai tab mở cùng một chuyến. Tab A lưu trước; tab B bấm Lưu với form
      // mở từ trước đó. `FOR UPDATE` tuần tự hoá hai lệnh nhưng không biết
      // cái nào cũ — payload mang giá trị từ FORM, không từ hàng vừa khoá.
      // Không có token thì B ghi đè êm ru thay đổi của A: ghế tụt về số cũ,
      // khách đặt tiếp đâm trần, claim trả `overbooked`, hệ thống tự hoàn tiền
      // người ĐÃ trả.
      const cu = await rowById(FREE);

      const truoc = await update(FREE, { ...editable(cu), seatsTotal: 14 }, adminCookie);
      expect(truoc.statusCode).toBe(200);

      const sau = await update(FREE, { ...editable(cu), seatsTotal: 10 }, adminCookie);

      expect(sau.statusCode).toBe(409);
      expect(sau.json().code).toBe('DEPARTURE_STALE');
      // 14 ghế của tab A còn nguyên — đó mới là điều đáng đo.
      expect((await rowById(FREE)).seatsTotal).toBe(14);
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
  describe('cancel — công ty huỷ chuyến (F13)', () => {
    /**
     * Không có worker nào chạy trong int test, nên đăng ký một sender GIẢ để
     * quan sát đúng thứ đáng quan sát: job nào được xếp, cho booking nào.
     */
    let queued: DepartureRefundJob[];

    beforeEach(() => {
      queued = [];
      registerDepartureRefundSender(async (_queue, job) => {
        queued.push(job);
      });
    });

    afterEach(() => {
      clearDepartureRefundSender();
    });

    const REASON = 'The guide is unavailable, so this departure is called off.';

    it('ba nhóm booking đi ba đường khác nhau', async () => {
      // PAID → xếp job hoàn tiền; PENDING → huỷ NGAY tại chỗ (chưa trả tiền
      // nên không có gì để hoàn, mà để lại thì một lượt thanh toán về sau sẽ
      // đâm vào chuyến đã huỷ); đã CANCELLED → không đụng tới.
      const res = await cancel(BOOKED, REASON, adminCookie);

      expect(res.statusCode).toBe(200);
      expect((await rowById(BOOKED)).status).toBe('CANCELLED');

      expect(queued).toHaveLength(1);
      expect(queued[0]?.bookingId).toBe(bookingId(1));
      expect(queued[0]?.reason).toBe(REASON);

      const rows = await prisma.booking.findMany({
        where: { departureId: BOOKED },
        orderBy: { code: 'asc' },
        select: { id: true, status: true },
      });
      // PAID vẫn PAID cho tới khi job chạy xong — tiền chưa đi thì chưa đổi sổ.
      expect(rows.map((row) => row.status)).toEqual([
        BookingStatus.PAID,
        BookingStatus.CANCELLED,
        BookingStatus.CANCELLED,
      ]);
    });

    it('ghi sổ vào CHÍNH chuyến: ai huỷ, khi nào, vì sao', async () => {
      // Một chuyến không có khách nào sẽ không để lại vết ở
      // `cancellation_requests`, nên ba cột này là nơi duy nhất trả lời.
      await cancel(FREE, REASON, adminCookie);

      const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
      const row = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: FREE } });
      expect(row.cancelReason).toBe(REASON);
      expect(row.cancelledBy).toBe(admin.id);
      expect(row.cancelledAt).not.toBeNull();
    });

    it('bấm huỷ LẦN HAI → 409 và KHÔNG xếp thêm job nào', async () => {
      await cancel(BOOKED, REASON, adminCookie);
      queued = [];

      const again = await cancel(BOOKED, REASON, adminCookie);

      expect(again.statusCode).toBe(409);
      expect(again.json().code).toBe('DEPARTURE_CANCELLED');
      expect(queued).toHaveLength(0);
    });

    it('chuyến ĐÃ khởi hành → 409 DEPARTURE_STARTED, không phải 200 im lặng', async () => {
      const res = await cancel(PAST, REASON, adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('DEPARTURE_STARTED');
      expect((await rowById(PAST)).status).not.toBe('CANCELLED');
    });

    it('lý do RỖNG bị từ chối ngay ở schema — sổ không được để trắng', async () => {
      const res = await cancel(FREE, '   ', adminCookie);

      expect(res.statusCode).toBe(400);
      expect((await rowById(FREE)).status).toBe('OPEN');
    });

    it('id lạ → 404', async () => {
      expect((await cancel(MISSING_ID, REASON, adminCookie)).statusCode).toBe(404);
    });

    it('khách thường không huỷ được chuyến', async () => {
      expect((await cancel(FREE, REASON, customerCookie)).statusCode).toBe(403);
      expect((await rowById(FREE)).status).toBe('OPEN');
    });
  });
  describe('F12 vòng hai — trần ghế và sổ P&L', () => {
    it('ghế vượt cỡ nhóm tour công bố → 422, không phải 500 ở tầng dưới', async () => {
      // `tours.max_group_size` là lời hứa in trên chính trang tour và nó quyết
      // cỡ xe. Không tầng nào bên dưới bắt được: CHECK của DB chỉ canh
      // `seats_booked <= seats_total`, không biết gì về tour.
      const max = (await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } })).maxGroupSize;

      const res = await create(
        {
          slug: PUBLISHED_SLUG,
          startDate: dateAt(100),
          endDate: dateAt(101),
          seatsTotal: max + 1,
        },
        adminCookie,
      );

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('SEATS_ABOVE_TOUR_MAX');
      // Câu mang sẵn con số tour cho phép — câu hỏi kế tiếp của admin luôn là
      // "vậy tối đa bao nhiêu?".
      expect(res.json().message).toContain(String(max));
    });

    it('ĐÚNG cỡ nhóm tối đa thì tạo được — chặn ở biên, không chặn quá tay', async () => {
      const max = (await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } })).maxGroupSize;

      const res = await create(
        {
          slug: PUBLISHED_SLUG,
          startDate: dateAt(102),
          endDate: dateAt(103),
          seatsTotal: max,
        },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
    });

    it('SỬA ghế vượt trần cũng bị chặn, không chỉ lúc tạo', async () => {
      const max = (await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } })).maxGroupSize;
      const before = await rowById(FREE);

      const res = await update(FREE, { ...editable(before), seatsTotal: max + 5 }, adminCookie);

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('SEATS_ABOVE_TOUR_MAX');
      expect((await rowById(FREE)).seatsTotal).toBe(before.seatsTotal);
    });

    it('chuyến ĐÃ CHẠY và có khách thì không dời được ngày — sổ P&L tháng đã chốt đứng yên', async () => {
      // Báo cáo gom giá vốn cố định theo `end_date` của chuyến
      // (`stats-aggregates.ts` → `fixedCostSlice`), và chỉ đếm chuyến CÓ khách
      // đã trả tiền. Dời ngày một chuyến như thế là chuyển một khoản chi phí
      // sang tháng khác — viết lại một con số đã báo cáo xong.
      //
      // Chốt chặn hiện tại đóng đúng cửa ấy: chuyến có khách thì `seats_booked`
      // khác 0, mà đổi ngày đòi `seats_booked = 0`. Ca này GHIM lại tính chất
      // đó, vì nó chỉ đúng nhờ thước `seats_booked` (vòng vá review F12) — bản
      // cũ đếm theo trạng thái booking và một booking hoàn-thiện-chí-trọn-tiền
      // đọc ra 0 trong khi vẫn tính vào P&L.
      const past = await prisma.tourDeparture.create({
        data: {
          tourId: tour.id,
          startDate: startOfDayUtc(dateAt(-40)),
          endDate: startOfDayUtc(dateAt(-38)),
          seatsTotal: 12,
          seatsBooked: 4,
          status: DepartureStatus.CLOSED,
          fixedCostAmount: '400.00',
        },
      });

      // Dời sang TƯƠNG LAI: qua được chốt "không lùi về quá khứ", nên thứ
      // chặn nó là đúng chốt ta muốn ghim.
      const res = await update(
        past.id,
        {
          startDate: dateAt(40),
          endDate: dateAt(42),
          seatsTotal: 12,
          priceOverride: null,
          version: past.updatedAt.toISOString(),
        },
        adminCookie,
      );

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('DEPARTURE_HAS_BOOKINGS');
      const after = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: past.id } });
      expect(after.endDate.toISOString()).toBe(past.endDate.toISOString());

      // Hướng còn lại — dời sang một ngày quá khứ KHÁC — bị chốt thứ hai chặn
      // trước. Hai chốt, hai lý do, cùng một kết quả: sổ đã chốt đứng yên.
      const lui = await update(
        past.id,
        {
          startDate: dateAt(-10),
          endDate: dateAt(-8),
          seatsTotal: 12,
          priceOverride: null,
          version: past.updatedAt.toISOString(),
        },
        adminCookie,
      );
      expect(lui.statusCode).toBe(422);
      expect(lui.json().code).toBe('START_IN_PAST');
    });
  });
});
