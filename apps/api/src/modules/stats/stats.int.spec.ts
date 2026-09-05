import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminBookingsStatsSchema,
  AdminCancellationsStatsSchema,
  AdminDashboardSeriesSchema,
  AdminEnquiriesStatsSchema,
  AdminOutboxStatsSchema,
  AdminPaymentEventsStatsSchema,
  AdminReviewsStatsSchema,
  AdminSubscribersStatsSchema,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
  EmailType,
  EnquiryStatus,
  OutboxStatus,
  PaymentProvider,
  ReviewSource,
} from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test) — stats vùng admin (spec P4b
 * §3-F5). Đây là số admin ĐEM SO SỔ, nên mỗi aggregate được bơm dữ liệu ở CẢ
 * HAI kỳ cộng một hàng nằm NGOÀI cả hai, rồi assert cả hai con số: một cửa sổ
 * lệch sẽ hiện ra ngay thay vì âm thầm nói dối trên card.
 *
 * Định nghĩa từng metric ở JSDoc `StatsService` — test này là bản đối chứng
 * chạy được của chính những câu đó.
 */

const PUBLISHED_SLUG = 'hoi-an-lantern-evening';
const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)
const CUSTOMER_EMAIL = 'stats-customer@tourism.test';

/**
 * Hàm chứ không phải `const tour = …find()` + `if (!tour) throw`: các helper
 * fixture bên dưới là function DECLARATION (được hoist), nên TS reset phép
 * thu hẹp kiểu của một const bắt được trong closure — trả về từ hàm thì kiểu
 * đã không-undefined ngay tại chỗ khai.
 */
function requireFixtureTour(slug: string) {
  const found = catalog.tours.find((t) => t.slug === slug);
  if (!found) throw new Error(`fixture tour missing: ${slug}`);
  return found;
}

const tour = requireFixtureTour(PUBLISHED_SLUG);

const DAY = 86_400_000;
/** Mốc "cách đây N ngày" — mọi fixture đặt xa biên 28/56 ngày để không rung. */
const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY);
const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);

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

describe('admin stats integration (F5)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;

  const future45 = new Date(Date.now() + 45 * DAY);
  const dep = {
    id: 'e9500001-0000-4000-8000-000000000001',
    tourId: tour.id,
    startDate: future45,
    endDate: new Date(future45.getTime() + DAY),
    seatsTotal: 500,
    seatsBooked: 0,
    status: DepartureStatus.OPEN,
  } satisfies Prisma.TourDepartureCreateManyInput;

  /** Id booking thứ n — review VERIFIED phải trỏ về một booking thật (CHECK). */
  const bookingId = (n: number) => `e9500002-0000-4000-8000-${String(n).padStart(12, '0')}`;

  /** Một booking với mốc thời gian ĐẶT TAY — cả hai kỳ mới dựng được. */
  function booking(
    n: number,
    row: { status: BookingStatus; total: string; createdAt: Date; paidAt: Date | null },
  ): Prisma.BookingCreateManyInput {
    return {
      id: bookingId(n),
      code: `BK-STAT${String(n).padStart(4, '0')}`,
      userId: customerId,
      tourId: tour.id,
      departureId: dep.id,
      numAdults: 1,
      numChildren: 0,
      totalAmount: row.total,
      unitPrice: row.total,
      currency: 'USD',
      status: row.status,
      tourTitle: tour.title,
      departureStartDate: dep.startDate,
      departureEndDate: dep.endDate,
      contactName: 'Ada Lovelace',
      contactEmail: CUSTOMER_EMAIL,
      paymentProvider: PaymentProvider.STRIPE,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
    };
  }

  function cancellation(
    n: number,
    row: {
      bookingId: string;
      status: CancellationRequestStatus;
      createdAt: Date;
      decidedAt: Date | null;
    },
  ): Prisma.CancellationRequestCreateManyInput {
    return {
      id: `e9500003-0000-4000-8000-${String(n).padStart(12, '0')}`,
      bookingId: row.bookingId,
      userId: customerId,
      reason: 'Family emergency — cannot travel.',
      status: row.status,
      createdAt: row.createdAt,
      decidedAt: row.decidedAt,
    };
  }

  /**
   * Một review với mốc thời gian đặt tay. CHECK `reviews_source_shape` ép
   * hình dạng theo nguồn: VERIFIED phải đủ tour+user+booking, CURATED phải
   * KHÔNG có user lẫn booking — nên `curated` không chỉ là một nhãn.
   */
  function review(
    n: number,
    row: {
      rating: number;
      isApproved: boolean;
      createdAt: Date;
      moderatedAt: Date | null;
      curated?: true;
    },
  ): Prisma.ReviewCreateManyInput {
    return {
      id: `e9500004-0000-4000-8000-${String(n).padStart(12, '0')}`,
      tourId: tour.id,
      rating: row.rating,
      body: 'A perfectly ordinary review body, long enough to be real.',
      authorName: 'Ada Lovelace',
      isApproved: row.isApproved,
      createdAt: row.createdAt,
      moderatedAt: row.moderatedAt,
      ...(row.curated
        ? { source: ReviewSource.CURATED }
        : { source: ReviewSource.VERIFIED, userId: customerId, bookingId: bookingId(n) }),
    };
  }

  /** GET một endpoint stats với cookie cho sẵn; `query` là query-string đã ghép. */
  async function get(path: string, cookie: string, query = '') {
    return app.inject({
      method: 'GET',
      url: `/api/admin/stats/${path}${query}`,
      headers: { cookie },
    });
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE tour_categories, destinations, users, payment_events, outbox, enquiries, subscribers CASCADE',
    );
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });
    await prisma.destination.createMany({ data: catalog.destinations });
    await prisma.tour.createMany({ data: [tour] as unknown as Prisma.TourCreateManyInput[] });
    await prisma.tourDeparture.createMany({ data: [dep] });

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
      // requireEmailVerification (siết 20/08): verify qua DB rồi đăng nhập.
      // Role đặt thẳng DB: từ ADR-0008 signup KHÔNG còn auto-promote theo
      // ADMIN_EMAILS, và guard đọc role tươi từ DB nên cookie dùng được ngay.
      await prisma.user.update({
        where: { email },
        data: { emailVerified: true, ...(email === ADMIN_EMAIL ? { role: 'ADMIN' } : {}) },
      });
    }
    const adminIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: ADMIN_EMAIL, password: PASSWORD },
    });
    adminCookie = sessionCookie(adminIn);
    const customerIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: CUSTOMER_EMAIL, password: PASSWORD },
    });
    customerCookie = sessionCookie(customerIn);
    customerId = (await prisma.user.findUniqueOrThrow({ where: { email: CUSTOMER_EMAIL } })).id;
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE bookings, refunds, cancellation_requests, reviews, review_moderation_events, outbox, payment_events, enquiries, subscribers CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('guard — cùng lớp với mọi endpoint admin còn lại, phủ CẢ TÁM path', () => {
    // Tham số hoá cả sáu (vòng vá review F5): guard đặt ở cấp class, nhưng
    // một refactor dời @Roles xuống từng handler mà sót 2/3 phải làm suite đỏ.
    for (const area of [
      'bookings',
      'cancellations',
      'reviews',
      'outbox',
      'payment-events',
      'enquiries',
      'subscribers',
      'dashboard',
    ] as const) {
      it(`${area}: ẩn danh → 401, khách thường → 403`, async () => {
        const anon = await app.inject({ method: 'GET', url: `/api/admin/stats/${area}` });
        expect(anon.statusCode).toBe(401);
        const customer = await get(area, customerCookie);
        expect(customer.statusCode).toBe(403);
      });
    }
  });

  describe('stats.bookings', () => {
    beforeEach(async () => {
      await prisma.booking.createMany({
        data: [
          // ── Kỳ NÀY (đã thu tiền trong 28 ngày gần nhất) ──
          booking(1, {
            status: BookingStatus.PAID,
            total: '100.00',
            createdAt: daysAgo(20),
            paidAt: daysAgo(20),
          }),
          // Đã thu tiền RỒI mới bị huỷ: tiền VẪN đi vào trong kỳ (revenue là
          // gross), và đây là tử số của tỉ lệ huỷ.
          booking(2, {
            status: BookingStatus.CANCELLED,
            total: '200.00',
            createdAt: daysAgo(10),
            paidAt: daysAgo(10),
          }),
          // Tạo trong kỳ nhưng CHƯA trả tiền — vào `newBookings`, không vào
          // revenue/paidBookings/mẫu số tỉ lệ huỷ.
          booking(3, {
            status: BookingStatus.PENDING,
            total: '300.00',
            createdAt: daysAgo(5),
            paidAt: null,
          }),
          // Đã thu tiền rồi hoàn ĐỦ qua đường refund trực tiếp — status là
          // REFUNDED, KHÔNG BAO GIỜ đụng CANCELLED (deriveStatusAfterRefund).
          // Vẫn là tử số của tỉ lệ huỷ (vòng vá review F5): tiền đã về hết,
          // khách không đi.
          booking(8, {
            status: BookingStatus.REFUNDED,
            total: '80.00',
            createdAt: daysAgo(12),
            paidAt: daysAgo(12),
          }),
          // ── Kỳ TRƯỚC (28–56 ngày) ──
          booking(4, {
            status: BookingStatus.PAID,
            total: '50.00',
            createdAt: daysAgo(40),
            paidAt: daysAgo(40),
          }),
          booking(5, {
            status: BookingStatus.PAID,
            total: '150.00',
            createdAt: daysAgo(35),
            paidAt: daysAgo(35),
          }),
          // CANCELLED nhưng CHƯA TỪNG trả tiền (checkout bỏ dở → TTL huỷ).
          // KHÔNG được tính vào tỉ lệ huỷ: đó là bỏ giỏ hàng, không phải huỷ.
          booking(6, {
            status: BookingStatus.CANCELLED,
            total: '400.00',
            createdAt: daysAgo(45),
            paidAt: null,
          }),
          // ── NGOÀI cả hai kỳ ──
          booking(7, {
            status: BookingStatus.PAID,
            total: '999.00',
            createdAt: daysAgo(70),
            paidAt: daysAgo(70),
          }),
        ],
      });
    });

    it('revenue = tiền đã THU trong kỳ (theo paidAt), gross — cả hai kỳ', async () => {
      const res = await get('bookings', adminCookie);
      expect(res.statusCode).toBe(200);
      const stats = AdminBookingsStatsSchema.parse(res.json());

      // 100 + 200 + 80 (booking 2 huỷ sau, booking 8 hoàn đủ sau — revenue
      // là GROSS, tiền vẫn đã đi vào trong kỳ)
      expect(stats.revenue.current).toBe('380.00');
      expect(stats.revenue.previous).toBe('200.00');
    });

    it('paidBookings đếm ĐÚNG tập đã sinh ra revenue', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      expect(stats.paidBookings).toEqual({ current: 3, previous: 2 });
    });

    it('newBookings đếm theo createdAt, MỌI trạng thái', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      expect(stats.newBookings).toEqual({ current: 4, previous: 3 });
    });

    it('cancellationRate đếm CANCELLED lẫn REFUNDED trên tập đã trả tiền — checkout bỏ dở không tính (vòng vá F5)', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      // Kỳ này: 2 (booking 2 huỷ qua queue + booking 8 hoàn đủ qua refund
      // trực tiếp) / 3 đã trả tiền = 66.7. Kỳ trước: 0 / 2 — booking 6
      // CANCELLED nhưng chưa từng trả tiền nên không ở mẫu số lẫn tử số.
      expect(stats.cancellationRate).toEqual({ current: '66.7', previous: '0.0' });
    });

    it('nói ra đồng tiền đã cộng — client không đoán ký hiệu cho một con số tiền', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      expect(stats.currency).toBe('USD');
    });

    it('period phơi ra hai mốc cắt UTC và độ dài cửa sổ', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      expect(stats.period.windowDays).toBe(28);
      const current = Date.parse(stats.period.currentFrom);
      const previous = Date.parse(stats.period.previousFrom);
      expect(Date.parse(stats.period.generatedAt) - current).toBe(28 * DAY);
      expect(current - previous).toBe(28 * DAY);
    });
  });

  /**
   * ADR-0028 — hàng card ăn theo bộ lọc ngày của bảng. Fixture ở đây neo vào
   * NGÀY LỊCH CỐ ĐỊNH (không phải `daysAgo`) vì chính khoảng ngày là thứ đang
   * được kiểm: một fixture trôi theo đồng hồ sẽ rời khỏi khoảng đã hỏi.
   */
  describe('stats.bookings — khoảng ngày do admin chọn', () => {
    /** 12:00 UTC: xa cả hai biên nửa đêm, nên không ca nào rung vì lệch giờ. */
    const at = (date: string) => new Date(`${date}T12:00:00.000Z`);

    beforeEach(async () => {
      await prisma.booking.createMany({
        data: [
          // ── Trong khoảng hỏi (tháng 5/2026) ──
          booking(101, {
            status: BookingStatus.PAID,
            total: '100.00',
            createdAt: at('2026-05-10'),
            paidAt: at('2026-05-10'),
          }),
          // Biên ĐẦU kỳ, tính vào: nửa đêm ngày 1 là `gte`.
          booking(102, {
            status: BookingStatus.PAID,
            total: '10.00',
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
            paidAt: new Date('2026-05-01T00:00:00.000Z'),
          }),
          // Biên CUỐI kỳ, VẪN tính vào: giây áp chót của ngày 31 — đây là ca
          // mà mốc `23:59:59` sẽ bỏ rơi (ADR-0028 §3).
          booking(103, {
            status: BookingStatus.PAID,
            total: '1.00',
            createdAt: new Date('2026-05-31T23:59:59.500Z'),
            paidAt: new Date('2026-05-31T23:59:59.500Z'),
          }),
          // ── Kỳ TRƯỚC (31 ngày liền trước 01/05 → bắt đầu 31/03) ──
          booking(104, {
            status: BookingStatus.PAID,
            total: '50.00',
            createdAt: at('2026-04-15'),
            paidAt: at('2026-04-15'),
          }),
          // ── NGOÀI cả hai kỳ: ngay sau kỳ này, và trước cả kỳ trước ──
          booking(105, {
            status: BookingStatus.PAID,
            total: '999.00',
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            paidAt: new Date('2026-06-01T00:00:00.000Z'),
          }),
          booking(106, {
            status: BookingStatus.PAID,
            total: '888.00',
            createdAt: at('2026-02-01'),
            paidAt: at('2026-02-01'),
          }),
        ],
      });
    });

    it('cắt ĐÚNG khoảng đã hỏi — trọn ngày cuối, và không lấn sang ngày kế', async () => {
      const res = await get('bookings', adminCookie, '?from=2026-05-01&to=2026-05-31');
      expect(res.statusCode).toBe(200);
      const stats = AdminBookingsStatsSchema.parse(res.json());

      // 100 + 10 + 1 — booking 103 lúc 23:59:59.500 VẪN vào (biên nửa-mở);
      // booking 105 lúc 00:00 ngày 1/6 thì KHÔNG.
      expect(stats.revenue.current).toBe('111.00');
      expect(stats.paidBookings.current).toBe(3);
      expect(stats.newBookings.current).toBe(3);
    });

    it('kỳ trước dài ĐÚNG BẰNG kỳ này và lùi liền kề — không phải tháng lịch trước', async () => {
      const stats = AdminBookingsStatsSchema.parse(
        (await get('bookings', adminCookie, '?from=2026-05-01&to=2026-05-31')).json(),
      );
      // Kỳ này 31 ngày → kỳ trước là [31/03, 01/05): booking 104 (15/04) vào,
      // booking 106 (01/02) thì không. Tháng 4 có 30 ngày nên "tháng lịch
      // trước" sẽ là một cửa sổ KHÁC — đây là chỗ hai cách hiểu tách nhau.
      expect(stats.revenue.previous).toBe('50.00');
      expect(stats.paidBookings.previous).toBe(1);

      const currentFrom = Date.parse(stats.period.currentFrom);
      const currentTo = Date.parse(stats.period.currentTo);
      const previousFrom = Date.parse(stats.period.previousFrom);
      expect(currentTo - currentFrom).toBe(currentFrom - previousFrom);
      expect(stats.period.windowDays).toBe(31);
    });

    it('period.currentTo là 00:00 ngày SAU `to`, và tách khỏi generatedAt', async () => {
      const stats = AdminBookingsStatsSchema.parse(
        (await get('bookings', adminCookie, '?from=2026-05-01&to=2026-05-31')).json(),
      );
      expect(stats.period.currentFrom).toBe('2026-05-01T00:00:00.000Z');
      expect(stats.period.currentTo).toBe('2026-06-01T00:00:00.000Z');
      expect(stats.period.previousFrom).toBe('2026-03-31T00:00:00.000Z');
      // Sổ chốt lúc gọi, không phải cuối kỳ — kỳ tháng 5 đọc hôm nay vẫn là
      // kỳ tháng 5.
      expect(stats.period.currentTo).not.toBe(stats.period.generatedAt);
      expect(Date.parse(stats.period.generatedAt)).toBeGreaterThan(
        Date.parse(stats.period.currentTo),
      );
    });

    it('không tham số: rơi về cửa sổ TRƯỢT 28 ngày như trước ADR-0028', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      expect(stats.period.windowDays).toBe(28);
      expect(stats.period.currentTo).toBe(stats.period.generatedAt);
      // Mọi fixture trên đều nằm ngoài 56 ngày gần nhất của đồng hồ thật.
      expect(stats.revenue).toEqual({ current: '0.00', previous: '0.00' });
    });

    it('khoảng NGƯỢC bị contract từ chối — 400, không phải một cửa sổ âm', async () => {
      const res = await get('bookings', adminCookie, '?from=2026-05-31&to=2026-05-01');
      expect(res.statusCode).toBe(400);
    });

    it('ngày không tồn tại cũng là 400 — hợp đồng chỉ nhận ngày lịch thật', async () => {
      expect((await get('bookings', adminCookie, '?from=2026-02-31')).statusCode).toBe(400);
      expect((await get('bookings', adminCookie, '?to=2026-05-31T00:00:00Z')).statusCode).toBe(400);
    });
  });

  describe('stats.bookings — kỳ rỗng', () => {
    it('không có booking nào: revenue 0.00, đếm 0, tỉ lệ null (không phải 0%)', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      // Không có booking nào để đọc đồng tiền — rơi về mặc định của cột DB,
      // chứ không để trống một field mà UI phải in ra cạnh con số tiền.
      expect(stats.currency).toBe('USD');
      expect(stats.revenue).toEqual({ current: '0.00', previous: '0.00' });
      expect(stats.paidBookings).toEqual({ current: 0, previous: 0 });
      expect(stats.cancellationRate).toEqual({ current: null, previous: null });
    });
  });

  describe('stats.dashboard (ADR-0036) — chuỗi theo ngày', () => {
    /**
     * 00:00.000 UTC của HÔM NAY — mốc mà mọi bucket ngày tính từ đó. Chụp
     * trong `beforeEach`, KHÔNG ở tầng describe (vòng vá review 05/09): file
     * này chạy sau nhiều spec khác, mốc chụp lúc load file mà request bắn
     * sau nửa đêm UTC là "hôm nay" của fixture thành "hôm qua" của server.
     */
    let todayUtc = new Date(0);
    /** Mốc "N ngày trước, lúc 12:00 UTC" — xa cả hai biên nửa đêm. */
    const noonDaysAgo = (days: number) =>
      new Date(todayUtc.getTime() - days * DAY + 12 * 3_600_000);
    const dateDaysAgo = (days: number) =>
      new Date(todayUtc.getTime() - days * DAY).toISOString().slice(0, 10);

    beforeEach(async () => {
      todayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
      await prisma.booking.createMany({
        data: [
          // Hôm nay: ĐÚNG 00:00.000 — biên đầu ngày, tính vào bucket hôm nay.
          booking(301, {
            status: BookingStatus.PAID,
            total: '100.00',
            createdAt: todayUtc,
            paidAt: todayUtc,
          }),
          // Hôm qua: giây áp chót — vẫn là bucket HÔM QUA (nửa-mở, không lùi
          // sang hôm nay và không bị `23:59:59` bỏ rơi).
          booking(302, {
            status: BookingStatus.PAID,
            total: '10.00',
            createdAt: new Date(todayUtc.getTime() - 500),
            paidAt: new Date(todayUtc.getTime() - 500),
          }),
          // Hai đơn cùng một ngày (3 ngày trước) — một bucket cộng dồn.
          booking(303, {
            status: BookingStatus.PAID,
            total: '20.00',
            createdAt: noonDaysAgo(3),
            paidAt: noonDaysAgo(3),
          }),
          booking(304, {
            status: BookingStatus.CANCELLED,
            total: '5.00',
            createdAt: noonDaysAgo(3),
            paidAt: noonDaysAgo(3),
          }),
          // 10 ngày trước: ngoài dải 7, trong dải 30/90.
          booking(305, {
            status: BookingStatus.PAID,
            total: '1000.00',
            createdAt: noonDaysAgo(10),
            paidAt: noonDaysAgo(10),
          }),
          // 100 ngày trước: ngoài cả 90.
          booking(306, {
            status: BookingStatus.PAID,
            total: '9999.00',
            createdAt: noonDaysAgo(100),
            paidAt: noonDaysAgo(100),
          }),
          // Tạo hôm nay (một giây sau nửa đêm — không ở tương lai dù chạy
          // lúc 00:00) nhưng CHƯA trả tiền: không có trong chuỗi (neo paid_at).
          booking(307, {
            status: BookingStatus.PENDING,
            total: '777.00',
            createdAt: new Date(todayUtc.getTime() + 1000),
            paidAt: null,
          }),
        ],
      });
    });

    it('mặc định 90 point, ngày tăng dần, kết ở HÔM NAY, ngày trống điền 0', async () => {
      const res = await get('dashboard', adminCookie);
      expect(res.statusCode).toBe(200);
      const series = AdminDashboardSeriesSchema.parse(res.json());

      expect(series.period.days).toBe(90);
      expect(series.points).toHaveLength(90);
      expect(series.points.at(-1)?.date).toBe(dateDaysAgo(0));
      expect(series.points[0]?.date).toBe(dateDaysAgo(89));
      expect(series.period.from).toBe(`${dateDaysAgo(89)}T00:00:00.000Z`);
      // Cửa sổ kết ở lúc chốt sổ — bucket hôm nay là bucket đang chạy.
      expect(series.period.to).toBe(series.period.generatedAt);
      // Ngày tăng dần, không trùng.
      const dates = series.points.map((p) => p.date);
      expect([...dates].sort()).toEqual(dates);
      expect(new Set(dates).size).toBe(dates.length);
      // Booking 306 (100 ngày) không có mặt; ngày 50 ngày trước trống.
      expect(series.points[39]).toEqual({ date: dateDaysAgo(50), revenue: '0.00', bookings: 0 });
      expect(series.currency).toBe('USD');
      // Đơn 307 (PENDING, tạo hôm nay, chưa trả) KHÔNG lọt vào bucket hôm nay.
      expect(series.points.at(-1)).toEqual({
        date: dateDaysAgo(0),
        revenue: '100.00',
        bookings: 1,
      });
    });

    it('bucket cắt theo ngày lịch UTC, biên nửa-mở — 00:00.000 vào hôm nay, 23:59:59.5 ở lại hôm qua', async () => {
      const series = AdminDashboardSeriesSchema.parse(
        (await get('dashboard', adminCookie, '?days=7')).json(),
      );
      const byDate = new Map(series.points.map((p) => [p.date, p]));
      expect(byDate.get(dateDaysAgo(0))).toEqual({
        date: dateDaysAgo(0),
        revenue: '100.00',
        bookings: 1,
      });
      expect(byDate.get(dateDaysAgo(1))).toEqual({
        date: dateDaysAgo(1),
        revenue: '10.00',
        bookings: 1,
      });
      // Hai đơn cùng ngày cộng dồn — kể cả đơn đã CANCELLED sau khi trả (gross).
      expect(byDate.get(dateDaysAgo(3))).toEqual({
        date: dateDaysAgo(3),
        revenue: '25.00',
        bookings: 2,
      });
      expect(byDate.get(dateDaysAgo(2))).toEqual({
        date: dateDaysAgo(2),
        revenue: '0.00',
        bookings: 0,
      });
    });

    it('`?days=7` ép từ QUERY STRING thành số (ZodSmartCoercion) và cắt đúng 7 ngày', async () => {
      const series = AdminDashboardSeriesSchema.parse(
        (await get('dashboard', adminCookie, '?days=7')).json(),
      );
      expect(series.period.days).toBe(7);
      expect(series.points).toHaveLength(7);
      expect(series.points[0]?.date).toBe(dateDaysAgo(6));
      // Booking 305 (10 ngày trước) nằm ngoài dải 7.
      const total = series.points.reduce((sum, p) => sum + Number(p.revenue), 0);
      expect(total).toBe(135);
    });

    it('cộng mọi point của dải 30 = revenue/paidBookings của `bookings?from&to` cùng khoảng', async () => {
      // Phép đối chứng mà ADR-0036 §2 hứa: chuỗi là card chia nhỏ theo ngày.
      const series = AdminDashboardSeriesSchema.parse(
        (await get('dashboard', adminCookie, '?days=30')).json(),
      );
      const stats = AdminBookingsStatsSchema.parse(
        (
          await get('bookings', adminCookie, `?from=${dateDaysAgo(29)}&to=${dateDaysAgo(0)}`)
        ).json(),
      );
      const revenue = series.points.reduce((sum, p) => sum + Number(p.revenue), 0);
      const bookings = series.points.reduce((sum, p) => sum + p.bookings, 0);
      expect(revenue.toFixed(2)).toBe(stats.revenue.current);
      expect(bookings).toBe(stats.paidBookings.current);
      expect(revenue).toBe(1135);
    });

    it('độ dài ngoài 7/30/90 bị contract từ chối — 400', async () => {
      expect((await get('dashboard', adminCookie, '?days=42')).statusCode).toBe(400);
      expect((await get('dashboard', adminCookie, '?days=abc')).statusCode).toBe(400);
      expect((await get('dashboard', adminCookie, '?days=0')).statusCode).toBe(400);
    });
  });

  describe('stats.dashboard — kỳ rỗng', () => {
    it('không có booking nào: vẫn đủ point, toàn 0, currency mặc định', async () => {
      const series = AdminDashboardSeriesSchema.parse(
        (await get('dashboard', adminCookie, '?days=7')).json(),
      );
      expect(series.points).toHaveLength(7);
      expect(series.points.every((p) => p.revenue === '0.00' && p.bookings === 0)).toBe(true);
      expect(series.currency).toBe('USD');
    });
  });

  describe('stats.cancellations', () => {
    beforeEach(async () => {
      await prisma.booking.createMany({
        data: [1, 2, 3, 4, 5].map((n) =>
          booking(n, {
            status: BookingStatus.PAID,
            total: '100.00',
            createdAt: daysAgo(60),
            paidAt: daysAgo(60),
          }),
        ),
      });
      await prisma.cancellationRequest.createMany({
        data: [
          // Mở từ trước đầu kỳ và vẫn mở: đứng trong CẢ hai ảnh chụp.
          cancellation(1, {
            bookingId: bookingId(1),
            status: CancellationRequestStatus.REQUESTED,
            createdAt: daysAgo(40),
            decidedAt: null,
          }),
          // Mở TRONG kỳ này: có ở ảnh chụp bây giờ, chưa tồn tại ở ảnh chụp cũ.
          cancellation(2, {
            bookingId: bookingId(2),
            status: CancellationRequestStatus.REQUESTED,
            createdAt: daysAgo(10),
            decidedAt: null,
          }),
          // Mở trước đầu kỳ, quyết TRONG kỳ này: hết mở bây giờ, nhưng đang
          // mở ở thời điểm đầu kỳ.
          cancellation(3, {
            bookingId: bookingId(3),
            status: CancellationRequestStatus.REFUNDED,
            createdAt: daysAgo(40),
            decidedAt: daysAgo(5),
          }),
          // Quyết TRONG kỳ trước.
          cancellation(4, {
            bookingId: bookingId(4),
            status: CancellationRequestStatus.DENIED,
            createdAt: daysAgo(50),
            decidedAt: daysAgo(45),
          }),
          cancellation(5, {
            bookingId: bookingId(4),
            status: CancellationRequestStatus.REFUNDED,
            createdAt: daysAgo(35),
            decidedAt: daysAgo(33),
          }),
          // NGOÀI cả hai kỳ.
          cancellation(6, {
            bookingId: bookingId(5),
            status: CancellationRequestStatus.REFUNDED,
            createdAt: daysAgo(70),
            decidedAt: daysAgo(65),
          }),
          // Mở trước đầu kỳ, từ chối trong kỳ này.
          cancellation(7, {
            bookingId: bookingId(5),
            status: CancellationRequestStatus.DENIED,
            createdAt: daysAgo(45),
            decidedAt: daysAgo(2),
          }),
        ],
      });
    });

    it('pendingQueue là ẢNH CHỤP: hàng đợi bây giờ so với hàng đợi lúc đầu kỳ', async () => {
      const stats = AdminCancellationsStatsSchema.parse(
        (await get('cancellations', adminCookie)).json(),
      );
      // Bây giờ: request 1, 2. Đầu kỳ: request 1, 3, 7 (đều đã mở và chưa
      // quyết tại mốc ấy) — dựng lại từ createdAt + decidedAt, không phải
      // đếm lại cùng một tập.
      expect(stats.pendingQueue).toEqual({ current: 2, previous: 3 });
    });

    it('approved/denied đếm theo decidedAt trong từng kỳ', async () => {
      const stats = AdminCancellationsStatsSchema.parse(
        (await get('cancellations', adminCookie)).json(),
      );
      expect(stats.approved).toEqual({ current: 1, previous: 1 });
      expect(stats.denied).toEqual({ current: 1, previous: 1 });
    });

    it('CHƯA lọc: ảnh chụp cuối kỳ khớp ĐÚNG số hàng `?status=REQUESTED`', async () => {
      // Lời hứa cũ của contract. Nay `current` dựng bằng `pendingRequestsAt`
      // tại `currentTo`, mà cửa sổ trượt có `currentTo === now` — nên con số
      // phải bằng đúng phép đếm thẳng trạng thái.
      const stats = AdminCancellationsStatsSchema.parse(
        (await get('cancellations', adminCookie)).json(),
      );
      const openNow = await prisma.cancellationRequest.count({
        where: { status: CancellationRequestStatus.REQUESTED },
      });
      expect(stats.pendingQueue.current).toBe(openNow);
    });
  });

  /**
   * ADR-0028 §AMEND — kỳ do admin chọn. `pendingQueue` là metric ẢNH CHỤP nên
   * lấy ở HAI ĐẦU kỳ (cuối kỳ vs đầu kỳ), không phải "bây giờ vs đầu kỳ".
   * Fixture neo vào ngày lịch cố định vì chính khoảng ngày là thứ đang kiểm.
   */
  describe('stats.cancellations — khoảng ngày do admin chọn', () => {
    const at = (date: string) => new Date(`${date}T12:00:00.000Z`);
    /** Lọc trọn tháng 5 → kỳ này [01/05, 01/06), kỳ trước [31/03, 01/05). */
    const MAY = '?from=2026-05-01&to=2026-05-31';

    beforeEach(async () => {
      await prisma.booking.createMany({
        data: [1, 2, 3, 4, 5].map((n) =>
          booking(n, {
            status: BookingStatus.PAID,
            total: '100.00',
            createdAt: at('2026-03-01'),
            paidAt: at('2026-03-01'),
          }),
        ),
      });
      await prisma.cancellationRequest.createMany({
        data: [
          // Mở trước kỳ và VẪN mở: đứng trong CẢ hai ảnh chụp.
          cancellation(11, {
            bookingId: bookingId(1),
            status: CancellationRequestStatus.REQUESTED,
            createdAt: at('2026-04-10'),
            decidedAt: null,
          }),
          // Mở TRONG kỳ và còn mở: chỉ ở ảnh chụp cuối kỳ.
          cancellation(12, {
            bookingId: bookingId(2),
            status: CancellationRequestStatus.REQUESTED,
            createdAt: at('2026-05-10'),
            decidedAt: null,
          }),
          // Mở trước kỳ, DUYỆT trong kỳ: chỉ ở ảnh chụp đầu kỳ, và tính vào
          // `approved` của kỳ này.
          cancellation(13, {
            bookingId: bookingId(3),
            status: CancellationRequestStatus.REFUNDED,
            createdAt: at('2026-04-05'),
            decidedAt: at('2026-05-20'),
          }),
          // Quyết XONG trước kỳ: không ở ảnh chụp nào, `denied` của kỳ TRƯỚC.
          cancellation(14, {
            bookingId: bookingId(4),
            status: CancellationRequestStatus.DENIED,
            createdAt: at('2026-04-02'),
            decidedAt: at('2026-04-20'),
          }),
          // Mở VÀ quyết trọn trong kỳ: không ở ảnh chụp nào, `denied` kỳ này.
          cancellation(15, {
            bookingId: bookingId(5),
            status: CancellationRequestStatus.DENIED,
            createdAt: at('2026-05-15'),
            decidedAt: at('2026-05-25'),
          }),
        ],
      });
    });

    it('pendingQueue là hàng đợi CUỐI kỳ so với ĐẦU kỳ, không phải "bây giờ"', async () => {
      const stats = AdminCancellationsStatsSchema.parse(
        (await get('cancellations', adminCookie, MAY)).json(),
      );
      // Cuối kỳ (01/06): 11 và 12 còn mở. Đầu kỳ (01/05): 11 còn mở, và 13
      // lúc ấy chưa bị quyết (decidedAt 20/05 >= 01/05).
      expect(stats.pendingQueue).toEqual({ current: 2, previous: 2 });
    });

    it('approved/denied cắt đúng kỳ theo decidedAt', async () => {
      const stats = AdminCancellationsStatsSchema.parse(
        (await get('cancellations', adminCookie, MAY)).json(),
      );
      expect(stats.approved).toEqual({ current: 1, previous: 0 });
      expect(stats.denied).toEqual({ current: 1, previous: 1 });
    });

    it('period: currentTo là 00:00 ngày sau `to`, kỳ trước dài bằng kỳ này', async () => {
      const stats = AdminCancellationsStatsSchema.parse(
        (await get('cancellations', adminCookie, MAY)).json(),
      );
      expect(stats.period.currentFrom).toBe('2026-05-01T00:00:00.000Z');
      expect(stats.period.currentTo).toBe('2026-06-01T00:00:00.000Z');
      expect(stats.period.previousFrom).toBe('2026-03-31T00:00:00.000Z');
      expect(stats.period.windowDays).toBe(31);
    });

    it('không tham số: rơi về cửa sổ TRƯỢT 28 ngày như trước ADR-0028', async () => {
      const stats = AdminCancellationsStatsSchema.parse(
        (await get('cancellations', adminCookie)).json(),
      );
      expect(stats.period.windowDays).toBe(28);
      expect(stats.period.currentTo).toBe(stats.period.generatedAt);
      // Hai hàng còn mở vẫn đứng trong ảnh chụp "bây giờ"; mọi quyết định thì
      // nằm ngoài 56 ngày gần nhất của đồng hồ thật.
      expect(stats.pendingQueue.current).toBe(2);
      expect(stats.approved).toEqual({ current: 0, previous: 0 });
    });

    it('khoảng ngược bị contract từ chối — 400', async () => {
      expect(
        (await get('cancellations', adminCookie, '?from=2026-05-31&to=2026-05-01')).statusCode,
      ).toBe(400);
    });
  });

  describe('stats.reviews', () => {
    beforeEach(async () => {
      // Sáu booking nền cho sáu review VERIFIED (`booking_id` là UNIQUE, nên
      // một booking một review); review CURATED không cần booking nào.
      await prisma.booking.createMany({
        data: [1, 2, 3, 4, 6, 7].map((n) =>
          booking(n, {
            status: BookingStatus.PAID,
            total: '100.00',
            createdAt: daysAgo(80),
            paidAt: daysAgo(80),
          }),
        ),
      });
      await prisma.review.createMany({
        data: [
          // Gửi trước đầu kỳ, chưa ai duyệt: đứng trong CẢ hai ảnh chụp.
          review(1, {
            rating: 3,
            isApproved: false,
            createdAt: daysAgo(40),
            moderatedAt: null,
          }),
          // Gửi TRONG kỳ này, còn chờ: chỉ có ở ảnh chụp bây giờ.
          review(2, { rating: 5, isApproved: false, createdAt: daysAgo(10), moderatedAt: null }),
          // Gửi trước đầu kỳ, duyệt TRONG kỳ này.
          review(3, {
            rating: 4,
            isApproved: true,
            createdAt: daysAgo(40),
            moderatedAt: daysAgo(5),
          }),
          // Duyệt trong kỳ TRƯỚC.
          review(4, {
            rating: 2,
            isApproved: true,
            createdAt: daysAgo(35),
            moderatedAt: daysAgo(33),
          }),
          // CURATED — testimonial biên tập vẫn tính vào điểm trung bình của kỳ
          // (định nghĩa: mọi review GỬI trong kỳ, không lọc nguồn).
          review(5, {
            rating: 4,
            isApproved: true,
            createdAt: daysAgo(3),
            moderatedAt: daysAgo(1),
            curated: true,
          }),
          // NGOÀI cả hai kỳ.
          review(6, {
            rating: 1,
            isApproved: true,
            createdAt: daysAgo(70),
            moderatedAt: daysAgo(65),
          }),
          // Gửi ở kỳ trước, duyệt TRONG kỳ này.
          review(7, {
            rating: 5,
            isApproved: true,
            createdAt: daysAgo(50),
            moderatedAt: daysAgo(2),
          }),
          // Duyệt trong kỳ này RỒI BỊ GỠ trong kỳ này (vòng vá review F5):
          // lượt duyệt vẫn phải được đếm — audit trail không bị xoá ngược.
          // createdAt ngoài cả hai kỳ để không đụng averageRating; CURATED để
          // khỏi cần booking thật (block này không seed booking 8).
          review(8, {
            rating: 3,
            isApproved: false,
            createdAt: daysAgo(70),
            moderatedAt: daysAgo(1),
            curated: true,
          }),
        ],
      });
      // `approved` đếm trên audit trail (vòng vá review F5) — bơm event khớp
      // mốc moderatedAt của từng review đã duyệt, actor null là hợp lệ
      // (FK SetNull). Review 8 có CẢ lượt duyệt lẫn lượt gỡ trong kỳ này.
      const event = (
        n: number,
        seq: number,
        toApproved: boolean,
        createdAt: Date,
      ): Prisma.ReviewModerationEventCreateManyInput => ({
        id: `e9500005-0000-4000-8000-${String(n * 10 + seq).padStart(12, '0')}`,
        reviewId: `e9500004-0000-4000-8000-${String(n).padStart(12, '0')}`,
        fromApproved: !toApproved,
        toApproved,
        createdAt,
      });
      await prisma.reviewModerationEvent.createMany({
        data: [
          event(3, 1, true, daysAgo(5)),
          event(4, 1, true, daysAgo(33)),
          event(5, 1, true, daysAgo(1)),
          event(6, 1, true, daysAgo(65)),
          event(7, 1, true, daysAgo(2)),
          event(8, 1, true, daysAgo(6)),
          event(8, 2, false, daysAgo(1)),
        ],
      });
    });

    it('pending là ẢNH CHỤP hàng đợi: bây giờ so với lúc đầu kỳ', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      // Bây giờ: review 1, 2, 8 (8 vừa bị gỡ duyệt nên quay lại hàng đợi).
      // Đầu kỳ: review 1, 3, 7 (đã gửi, chưa moderate tại mốc ấy); review 8
      // tại mốc ấy đang approved (flip cuối nằm SAU mốc → đảo ngược ra true).
      expect(stats.pending).toEqual({ current: 3, previous: 3 });
    });

    it('approved đếm LƯỢT DUYỆT trên audit trail — un-approve về sau không xoá ngược (vòng vá F5)', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      // Kỳ này: event duyệt của review 3, 5, 7, 8 — review 8 đã bị gỡ sau đó
      // nhưng LƯỢT duyệt vẫn đứng nguyên; event gỡ (toApproved=false) không
      // trừ đi đâu cả. Kỳ trước: review 4.
      expect(stats.approved).toEqual({ current: 4, previous: 1 });
    });

    it('averageRating tính trên review GỬI trong kỳ, kể cả cái còn chờ duyệt', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      // Kỳ này: review 2 (5 sao, còn chờ) + review 5 (4 sao) → 4.50. Không
      // lọc theo trạng thái duyệt: nếu lọc, một hàng đợi tồn đọng sẽ tự làm
      // kỳ này trông khác kỳ trước mà chẳng khách nào đổi ý cả.
      expect(stats.averageRating.current).toBe('4.50');
      // Kỳ trước: 3 + 4 + 2 + 5 = 14 / 4 → 3.50.
      expect(stats.averageRating.previous).toBe('3.50');
    });

    it('submitted đếm mọi review gửi trong kỳ — kể cả cái sẽ bị bác', async () => {
      // `submitted` đo KHỐI LƯỢNG VIỆC: một review bị bác vẫn là một review có
      // người phải đọc. Khi chưa có cái nào bị bác thì nó trùng tập với
      // `averageRating`; ca chúng TÁCH nhau có test riêng bên dưới.
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      // Kỳ này: review 2 và 5. Kỳ trước: bốn review của phép tính 3.50 ở trên.
      expect(stats.submitted).toEqual({ current: 2, previous: 4 });
    });
  });

  /**
   * ADR-0028 §AMEND 2 — kỳ do admin chọn ở vùng thứ ba. Fixture neo ngày lịch
   * cố định vì chính khoảng ngày là thứ đang kiểm.
   *
   * Điểm phải canh riêng của vùng này: `submitted`/`averageRating` neo
   * `review.created_at` còn `approved` neo `event.created_at`, nên một review
   * gửi TRƯỚC kỳ mà duyệt TRONG kỳ phải đếm vào `approved` mà KHÔNG đếm vào
   * `submitted`. Đó là lệch cột đã chấp nhận có ý thức, không phải bug.
   */
  describe('stats.reviews — khoảng ngày do admin chọn', () => {
    const at = (date: string) => new Date(`${date}T12:00:00.000Z`);
    /** Lọc trọn tháng 5 → kỳ này [01/05, 01/06), kỳ trước [31/03, 01/05). */
    const MAY = '?from=2026-05-01&to=2026-05-31';

    beforeEach(async () => {
      await prisma.review.createMany({
        data: [
          // Gửi TRƯỚC kỳ, chưa ai duyệt: đứng trong CẢ hai ảnh chụp hàng đợi.
          review(21, {
            rating: 3,
            isApproved: false,
            createdAt: at('2026-04-10'),
            moderatedAt: null,
            curated: true,
          }),
          // Gửi TRONG kỳ, còn chờ: chỉ ở ảnh chụp CUỐI kỳ.
          review(22, {
            rating: 5,
            isApproved: false,
            createdAt: at('2026-05-10'),
            moderatedAt: null,
            curated: true,
          }),
          // Gửi TRƯỚC kỳ, duyệt TRONG kỳ: vào `approved` kỳ này, KHÔNG vào
          // `submitted` kỳ này — đây là chỗ hai cột neo tách nhau.
          review(23, {
            rating: 4,
            isApproved: true,
            createdAt: at('2026-04-05'),
            moderatedAt: at('2026-05-20'),
            curated: true,
          }),
          // Gửi TRONG kỳ và duyệt luôn trong kỳ.
          review(24, {
            rating: 2,
            isApproved: true,
            createdAt: at('2026-05-15'),
            moderatedAt: at('2026-05-16'),
            curated: true,
          }),
        ],
      });
      const event = (
        n: number,
        toApproved: boolean,
        createdAt: Date,
      ): Prisma.ReviewModerationEventCreateManyInput => ({
        id: `e9500006-0000-4000-8000-${String(n).padStart(12, '0')}`,
        reviewId: `e9500004-0000-4000-8000-${String(n).padStart(12, '0')}`,
        fromApproved: !toApproved,
        toApproved,
        createdAt,
      });
      await prisma.reviewModerationEvent.createMany({
        data: [event(23, true, at('2026-05-20')), event(24, true, at('2026-05-16'))],
      });
    });

    it('submitted cắt theo review.created_at — review duyệt-trong-kỳ mà gửi trước KHÔNG tính', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie, MAY)).json());
      // Kỳ này: 22 và 24. Kỳ trước [31/03, 01/05): 21 và 23.
      expect(stats.submitted).toEqual({ current: 2, previous: 2 });
    });

    it('approved cắt theo event.created_at — hai lượt duyệt đều nằm trong kỳ', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie, MAY)).json());
      // 23 gửi tháng 4 nhưng duyệt 20/05: vào kỳ này dù không có mặt trong
      // `submitted` của kỳ này. Đó là lệch cột đã ghi ở ADR.
      expect(stats.approved).toEqual({ current: 2, previous: 0 });
    });

    it('pending là hàng đợi CUỐI kỳ so với ĐẦU kỳ, không phải "bây giờ"', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie, MAY)).json());
      // Cuối kỳ (01/06): 21 và 22 còn chờ. Đầu kỳ (01/05): 21 còn chờ, và 23
      // lúc ấy chưa bị duyệt (moderatedAt 20/05 >= 01/05).
      expect(stats.pending).toEqual({ current: 2, previous: 2 });
    });

    it('averageRating tính trên ĐÚNG tập submitted của kỳ', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie, MAY)).json());
      // Kỳ này: 22 (5 sao) + 24 (2 sao) → 3.50.
      expect(stats.averageRating.current).toBe('3.50');
    });

    it('period: currentTo là 00:00 ngày sau `to`, kỳ trước dài bằng kỳ này', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie, MAY)).json());
      expect(stats.period.currentFrom).toBe('2026-05-01T00:00:00.000Z');
      expect(stats.period.currentTo).toBe('2026-06-01T00:00:00.000Z');
      expect(stats.period.previousFrom).toBe('2026-03-31T00:00:00.000Z');
      expect(stats.period.windowDays).toBe(31);
    });

    it('không tham số: rơi về cửa sổ TRƯỢT 28 ngày như trước ADR-0028', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      expect(stats.period.windowDays).toBe(28);
      expect(stats.period.currentTo).toBe(stats.period.generatedAt);
      // Fixture toàn tháng 4–5 năm 2026, nằm ngoài 56 ngày gần nhất của đồng
      // hồ thật, nên hai lát kỳ rỗng; hàng đợi thì vẫn đếm được.
      expect(stats.submitted).toEqual({ current: 0, previous: 0 });
    });

    it('khoảng ngược bị contract từ chối — 400', async () => {
      expect((await get('reviews', adminCookie, '?from=2026-05-31&to=2026-05-01')).statusCode).toBe(
        400,
      );
    });
  });

  /**
   * Dựng lại hàng đợi moderation ở mốc đầu kỳ KHÔNG được chỉ nhìn dấu thời
   * gian: `moderated_at` null nghĩa là "chưa ai bấm nút", KHÔNG phải "đang
   * chờ" — seed sản xuất tạo 84 testimonial CURATED với `is_approved = true`
   * và `moderated_at` null, và bản đầu của F5 đếm cả 84 cái đó là hàng đợi
   * của 28 ngày trước (đo được: current 0 / previous 84).
   */
  describe('stats.reviews — dựng lại hàng đợi ở mốc đầu kỳ', () => {
    it('review DUYỆT NGAY LÚC TẠO (moderated_at null) KHÔNG phải hàng đợi cũ', async () => {
      await prisma.review.createMany({
        data: [
          review(11, {
            rating: 5,
            isApproved: true,
            createdAt: daysAgo(60),
            moderatedAt: null,
            curated: true,
          }),
        ],
      });
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      expect(stats.pending).toEqual({ current: 0, previous: 0 });
    });

    it('review CHƯA DUYỆT, quyết định gần nhất TRƯỚC mốc: vẫn là hàng đợi lúc ấy', async () => {
      // Gỡ duyệt (hoặc từ chối) 35 ngày trước rồi để đó — hôm nay vẫn nằm
      // trong hàng đợi, và 28 ngày trước cũng vậy.
      await prisma.review.createMany({
        data: [
          review(12, {
            rating: 2,
            isApproved: false,
            createdAt: daysAgo(60),
            moderatedAt: daysAgo(35),
            curated: true,
          }),
        ],
      });
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      expect(stats.pending).toEqual({ current: 1, previous: 1 });
    });
  });

  /**
   * Vòng 05/09 — review ĐÃ BỊ BÁC không còn tính vào `averageRating`.
   *
   * Một review 1 sao spam đã bị bác vẫn kéo tụt điểm trung bình dù không ai
   * đăng nó lên. Đây cũng là chỗ `submitted` và `averageRating` CHÍNH THỨC
   * tách tập: một cái đo khối lượng việc, một cái đo ý kiến.
   */
  describe('stats.reviews — review bị bác KHÔNG kéo điểm trung bình', () => {
    beforeEach(async () => {
      await prisma.review.createMany({
        data: [
          // Ý kiến thật, 5 sao.
          review(41, {
            rating: 5,
            isApproved: true,
            createdAt: daysAgo(3),
            moderatedAt: daysAgo(2),
            curated: true,
          }),
          // Spam 1 sao, đã bị bác — KHÔNG được vào phép trung bình.
          review(42, {
            rating: 1,
            isApproved: false,
            createdAt: daysAgo(3),
            moderatedAt: daysAgo(2),
            curated: true,
          }),
          // Đang chờ duyệt, 5 sao — VẪN là ý kiến thật, phải được tính.
          review(43, {
            rating: 5,
            isApproved: false,
            createdAt: daysAgo(3),
            moderatedAt: null,
            curated: true,
          }),
        ],
      });
      await prisma.review.update({
        where: { id: 'e9500004-0000-4000-8000-000000000042' },
        data: { rejectedAt: daysAgo(2) },
      });
    });

    it('điểm trung bình bỏ review bị bác, GIỮ review đang chờ duyệt', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      // (5 + 5) / 2 = 5.00. Tính cả cái 1 sao bị bác thì ra 3.67 — và đó là
      // con số bản cũ in ra.
      expect(stats.averageRating.current).toBe('5.00');
    });

    it('nhưng `submitted` VẪN đếm nó — hai card đo hai thứ khác nhau', async () => {
      // Đây là chỗ bất biến "cùng một tập" của bản đầu bị phá CÓ CHỦ ĐÍCH.
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      expect(stats.submitted.current).toBe(3);
    });
  });

  /**
   * ADR-0031 §5 — card `Pending` đổi nghĩa: nó đếm review CHƯA CÓ PHÁN QUYẾT,
   * không còn là "chưa đăng". Đây là lý do chính ADR ấy tồn tại, nên nó phải
   * có test riêng chứ không nấp trong một assert phụ.
   */
  describe('stats.reviews — review bị bác RỜI hàng đợi', () => {
    beforeEach(async () => {
      await prisma.review.createMany({
        data: [
          // Gửi TRƯỚC đầu kỳ để cả hai đều tồn tại ở mốc dựng lại.
          review(31, {
            rating: 4,
            isApproved: false,
            createdAt: daysAgo(40),
            moderatedAt: null,
            curated: true,
          }),
          // Đã bị bác — KHÔNG được đếm ở hiện tại, dù `is_approved` vẫn false.
          review(32, {
            rating: 2,
            isApproved: false,
            createdAt: daysAgo(40),
            moderatedAt: daysAgo(1),
            curated: true,
          }),
        ],
      });
      await prisma.review.update({
        where: { id: 'e9500004-0000-4000-8000-000000000032' },
        data: { rejectedAt: daysAgo(1) },
      });
    });

    it('pending BÂY GIỜ chỉ đếm review chưa có phán quyết', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      // Trước ADR-0031 con số này là 2 — hàng đợi nuốt cả review đã bác, tức
      // một số chỉ có thể phình ra.
      expect(stats.pending.current).toBe(1);
    });

    it('dựng lại quá khứ: review bị bác SAU mốc thì tại mốc nó VẪN đang chờ', async () => {
      // Bác ở ngày thứ 1, mốc đầu kỳ là 28 ngày trước → tại mốc ấy cả hai còn
      // chờ. Thiếu nhánh này thì hàng đợi quá khứ bị đếm hụt và card vẽ ra một
      // cú "dọn sạch" chưa từng xảy ra.
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      expect(stats.pending.previous).toBe(2);
    });
  });

  describe('stats.reviews — kỳ rỗng', () => {
    it('không có review nào: đếm 0 và điểm trung bình null (không phải 0 sao)', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      expect(stats.pending).toEqual({ current: 0, previous: 0 });
      expect(stats.averageRating).toEqual({ current: null, previous: null });
    });
  });

  describe('stats.outbox (F7)', () => {
    /** Một row outbox với mốc đặt tay — `processedAt` là thứ `sent` neo vào. */
    const outboxRow = (
      n: number,
      row: { status: OutboxStatus; createdAt: Date; processedAt: Date | null },
    ): Prisma.OutboxCreateManyInput => ({
      id: `e9500007-0000-4000-8000-${String(n).padStart(12, '0')}`,
      type: EmailType.BOOKING_CONFIRMATION,
      payload: { code: `BK-STAT${n}` },
      dedupeKey: `stats-outbox:${n}`,
      status: row.status,
      attempts: row.status === OutboxStatus.FAILED ? 5 : 0,
      lastError: row.status === OutboxStatus.FAILED ? 'boom' : null,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
    });

    beforeEach(async () => {
      await prisma.outbox.createMany({
        data: [
          // ── SENT theo processedAt: 2 kỳ này, 1 kỳ trước, 1 ngoài cả hai ──
          outboxRow(1, {
            status: OutboxStatus.SENT,
            createdAt: daysAgo(10),
            processedAt: daysAgo(10),
          }),
          // Tạo kỳ TRƯỚC nhưng giao kỳ NÀY → sent neo processedAt, thuộc kỳ này.
          outboxRow(2, {
            status: OutboxStatus.SENT,
            createdAt: daysAgo(30),
            processedAt: daysAgo(2),
          }),
          outboxRow(3, {
            status: OutboxStatus.SENT,
            createdAt: daysAgo(40),
            processedAt: daysAgo(40),
          }),
          outboxRow(4, {
            status: OutboxStatus.SENT,
            createdAt: daysAgo(70),
            processedAt: daysAgo(70),
          }),
          // ── Ảnh chụp: 3 PENDING (kể cả một cái rất cũ), 2 FAILED ──
          outboxRow(5, { status: OutboxStatus.PENDING, createdAt: daysAgo(1), processedAt: null }),
          outboxRow(6, { status: OutboxStatus.PENDING, createdAt: daysAgo(3), processedAt: null }),
          outboxRow(7, { status: OutboxStatus.PENDING, createdAt: daysAgo(90), processedAt: null }),
          outboxRow(8, { status: OutboxStatus.FAILED, createdAt: daysAgo(5), processedAt: null }),
          outboxRow(9, { status: OutboxStatus.FAILED, createdAt: daysAgo(60), processedAt: null }),
          // ── SKIPPED trong kỳ: có processedAt nhưng chưa từng tới Resend ──
          outboxRow(10, {
            status: OutboxStatus.SKIPPED,
            createdAt: daysAgo(4),
            processedAt: daysAgo(4),
          }),
        ],
      });
    });

    it('sent đếm SENT theo processedAt trong KỲ NÀY — hàng kỳ trước/ngoài kỳ và SKIPPED không tính', async () => {
      // Vòng vá review F7: một số đơn (purge 30 ngày xoá gần hết kỳ trước nên
      // không có cặp), và SKIPPED (worker cố ý không gửi) không phải "đã giao".
      const stats = AdminOutboxStatsSchema.parse((await get('outbox', adminCookie)).json());
      expect(stats.sent).toBe(2);
    });

    it('queued/failed là ẢNH CHỤP bây giờ, không phân biệt tuổi hàng', async () => {
      const stats = AdminOutboxStatsSchema.parse((await get('outbox', adminCookie)).json());
      expect(stats.queued).toBe(3);
      expect(stats.failed).toBe(2);
      expect(stats.period.windowDays).toBe(28);
    });
  });

  describe('stats.outbox — kỳ rỗng', () => {
    it('bảng trống: sent 0/0, hàng đợi 0 — con số thật, không phải lỗi', async () => {
      const stats = AdminOutboxStatsSchema.parse((await get('outbox', adminCookie)).json());
      expect(stats).toMatchObject({ sent: 0, queued: 0, failed: 0 });
    });
  });

  describe('stats.paymentEvents (F8)', () => {
    /** Một row payment_events với mốc đặt tay — `receivedAt` là thứ hai cặp neo vào. */
    const paymentEvent = (
      n: number,
      row: { receivedAt: Date; processedAt: Date | null; linked: boolean },
    ): Prisma.PaymentEventCreateManyInput => ({
      id: `e9500008-0000-4000-8000-${String(n).padStart(12, '0')}`,
      provider: n % 2 === 0 ? PaymentProvider.PAYPAL : PaymentProvider.STRIPE,
      eventId: `stats-evt-${n}`,
      type: row.linked ? 'payment.completed' : 'other',
      payload: { id: `stats-evt-${n}` },
      // Cột không có FK: bookingId hợp lệ về dạng là đủ để đếm "linked".
      bookingId: row.linked ? bookingId(n) : null,
      receivedAt: row.receivedAt,
      processedAt: row.processedAt,
    });

    beforeEach(async () => {
      await prisma.paymentEvent.createMany({
        data: [
          // ── Kỳ NÀY: 3 nhận, 2 trong đó gắn booking, 1 chưa xử lý xong ──
          // Row 1 vừa tới (1 phút): chưa xong là handler ĐANG chạy — đếm
          // vào unprocessed nhưng KHÔNG "kẹt" (ngưỡng 5 phút, vòng vá F8).
          paymentEvent(1, { receivedAt: minutesAgo(1), processedAt: null, linked: true }),
          paymentEvent(2, { receivedAt: daysAgo(10), processedAt: daysAgo(10), linked: true }),
          paymentEvent(3, { receivedAt: daysAgo(20), processedAt: daysAgo(20), linked: false }),
          // ── Kỳ TRƯỚC: 2 nhận, 1 gắn booking ──
          paymentEvent(4, { receivedAt: daysAgo(30), processedAt: daysAgo(30), linked: true }),
          paymentEvent(5, { receivedAt: daysAgo(40), processedAt: daysAgo(40), linked: false }),
          // ── Ngoài cả hai kỳ, nhưng CHƯA xử lý → vẫn vào ảnh chụp unprocessed ──
          paymentEvent(6, { receivedAt: daysAgo(70), processedAt: null, linked: true }),
        ],
      });
    });

    it('received/linked đếm theo receivedAt ở CẢ HAI kỳ — hàng ngoài kỳ không tính', async () => {
      const stats = AdminPaymentEventsStatsSchema.parse(
        (await get('payment-events', adminCookie)).json(),
      );
      expect(stats.received).toEqual({ current: 3, previous: 2 });
      expect(stats.linked).toEqual({ current: 2, previous: 1 });
      expect(stats.period.windowDays).toBe(28);
    });

    it('unprocessed là ẢNH CHỤP bây giờ, không phân biệt tuổi hàng; stuck chỉ đếm row quá ngưỡng', async () => {
      const stats = AdminPaymentEventsStatsSchema.parse(
        (await get('payment-events', adminCookie)).json(),
      );
      expect(stats.unprocessed).toBe(2);
      // Row 6 (70 ngày, chưa xong) kẹt; row 1 (1 phút) đang chạy — không kẹt.
      expect(stats.stuck).toBe(1);
    });
  });

  describe('stats.paymentEvents — kỳ rỗng', () => {
    it('bảng trống: cặp 0/0 và ảnh chụp 0 — con số thật, không phải lỗi', async () => {
      const stats = AdminPaymentEventsStatsSchema.parse(
        (await get('payment-events', adminCookie)).json(),
      );
      expect(stats).toMatchObject({
        received: { current: 0, previous: 0 },
        unprocessed: 0,
        stuck: 0,
        linked: { current: 0, previous: 0 },
      });
    });
  });
  describe('stats.enquiries (F9)', () => {
    const enquiryId = (n: number) => `e9500009-0000-4000-8000-${String(n).padStart(12, '0')}`;

    /** Một lead với mốc tạo + trạng thái HIỆN TẠI đặt tay. */
    const enquiry = (
      n: number,
      row: { createdAt: Date; status: EnquiryStatus },
    ): Prisma.EnquiryCreateManyInput => ({
      id: enquiryId(n),
      name: `Stat lead ${n}`,
      email: `stat-lead-${n}@example.com`,
      message: `Message body for stat lead ${n}.`,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
    });

    /** Một dòng audit — `createdAt` của EVENT là thứ metric `won` neo vào. */
    const statusEvent = (
      n: number,
      row: { toStatus: EnquiryStatus; createdAt: Date; lead?: number },
    ): Prisma.EnquiryStatusEventCreateManyInput => ({
      id: `e950000a-0000-4000-8000-${String(n).padStart(12, '0')}`,
      enquiryId: enquiryId(row.lead ?? n),
      adminId: null,
      fromStatus: EnquiryStatus.QUOTED,
      toStatus: row.toStatus,
      createdAt: row.createdAt,
    });

    beforeEach(async () => {
      await prisma.enquiry.createMany({
        data: [
          // ── Tạo trong KỲ NÀY: 2 ──
          enquiry(1, { createdAt: daysAgo(3), status: EnquiryStatus.NEW }),
          enquiry(2, { createdAt: daysAgo(20), status: EnquiryStatus.CONTACTED }),
          // ── Tạo ở KỲ TRƯỚC: 1 ──
          enquiry(3, { createdAt: daysAgo(40), status: EnquiryStatus.QUOTED }),
          // ── Ngoài cả hai kỳ, nhưng vẫn ĐANG MỞ → vào ảnh chụp `open` ──
          enquiry(4, { createdAt: daysAgo(90), status: EnquiryStatus.NEW }),
          // Chung cuộc — KHÔNG vào `open`.
          enquiry(5, { createdAt: daysAgo(80), status: EnquiryStatus.WON }),
          enquiry(6, { createdAt: daysAgo(80), status: EnquiryStatus.LOST }),
        ],
      });
      await prisma.enquiryStatusEvent.createMany({
        data: [
          // WON trong KỲ NÀY: 2 — một trên lead giờ đã LOST (thắng rồi mất
          // lại). Đếm theo TRẠNG THÁI HIỆN TẠI sẽ bỏ sót đúng dòng này.
          statusEvent(5, { toStatus: EnquiryStatus.WON, createdAt: daysAgo(2) }),
          statusEvent(6, { toStatus: EnquiryStatus.WON, createdAt: daysAgo(5) }),
          // Lead 5 sang WON LẦN THỨ HAI trong kỳ (bấm nhầm → sửa → WON thật):
          // hai event, MỘT lead — DISTINCT (vòng vá review F9).
          statusEvent(7, { toStatus: EnquiryStatus.WON, createdAt: daysAgo(6), lead: 5 }),
          // WON ở KỲ TRƯỚC: 1.
          statusEvent(3, { toStatus: EnquiryStatus.WON, createdAt: daysAgo(45) }),
          // Ngoài cả hai kỳ — không tính vào kỳ nào.
          statusEvent(4, { toStatus: EnquiryStatus.WON, createdAt: daysAgo(70) }),
          // Không phải WON — không được lọt vào con số nào.
          statusEvent(1, { toStatus: EnquiryStatus.LOST, createdAt: daysAgo(1) }),
          statusEvent(2, { toStatus: EnquiryStatus.CONTACTED, createdAt: daysAgo(4) }),
        ],
      });
    });

    it('created đếm theo createdAt ở CẢ HAI kỳ, MỌI trạng thái (không lọc status NEW)', async () => {
      const stats = AdminEnquiriesStatsSchema.parse((await get('enquiries', adminCookie)).json());
      expect(stats.created).toEqual({ current: 2, previous: 1 });
      expect(stats.period.windowDays).toBe(28);
    });

    it('won đếm LEAD trên EVENT audit (DISTINCT), không trên trạng thái hiện tại — lead thắng-rồi-mất vẫn tính', async () => {
      const stats = AdminEnquiriesStatsSchema.parse((await get('enquiries', adminCookie)).json());
      // Lead 6 hiện LOST nhưng ĐÃ có một lượt sang WON trong kỳ: đếm theo
      // `enquiries.status` sẽ ra 1; lead 5 có HAI event WON trong kỳ: đếm
      // lượt sẽ ra 3 — đếm lead DISTINCT ra 2.
      expect(stats.won).toEqual({ current: 2, previous: 1 });
    });

    it('open là ẢNH CHỤP NEW+CONTACTED+QUOTED bây giờ, không phân biệt tuổi lead', async () => {
      const stats = AdminEnquiriesStatsSchema.parse((await get('enquiries', adminCookie)).json());
      // Lead 1 (NEW) + 2 (CONTACTED) + 3 (QUOTED) + 4 (NEW, 90 ngày) = 4;
      // lead 5 (WON) và 6 (LOST) là chung cuộc.
      expect(stats.open).toBe(4);
    });
  });

  describe('stats.enquiries — kỳ rỗng', () => {
    it('bảng trống: cặp 0/0 và ảnh chụp 0 — con số thật, không phải lỗi', async () => {
      const stats = AdminEnquiriesStatsSchema.parse((await get('enquiries', adminCookie)).json());
      expect(stats).toMatchObject({
        created: { current: 0, previous: 0 },
        won: { current: 0, previous: 0 },
        open: 0,
      });
    });
  });

  describe('stats.subscribers (F10)', () => {
    /** Một địa chỉ với mốc đăng ký + mốc rút consent đặt tay. */
    const subscriber = (
      n: number,
      row: { createdAt: Date; unsubscribedAt?: Date },
    ): Prisma.SubscriberCreateManyInput => ({
      id: `fa50000b-0000-4000-8000-${String(n).padStart(12, '0')}`,
      email: `stat-sub-${n}@example.com`,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
      unsubscribedAt: row.unsubscribedAt ?? null,
    });

    beforeEach(async () => {
      await prisma.subscriber.createMany({
        data: [
          // Hai metric neo HAI cột khác nhau, nên fixture cố ý cho mỗi hàng
          // một tổ hợp riêng: hàng đổi chỗ giữa `created` và `unsubscribed`
          // sẽ làm sai đúng một con số thay vì trôi cả bộ.
          //
          // ── Đăng ký KỲ NÀY: 2 ──
          subscriber(1, { createdAt: daysAgo(3) }),
          subscriber(2, { createdAt: daysAgo(20), unsubscribedAt: daysAgo(2) }),
          // ── Đăng ký KỲ TRƯỚC: 1 — nhưng huỷ ở KỲ NÀY ──
          subscriber(3, { createdAt: daysAgo(40), unsubscribedAt: daysAgo(5) }),
          // ── Huỷ ở KỲ TRƯỚC: 1 (đăng ký từ lâu, ngoài cả hai kỳ) ──
          subscriber(4, { createdAt: daysAgo(90), unsubscribedAt: daysAgo(45) }),
          // Ngoài cả hai kỳ mà vẫn CÒN NHẬN TIN → chỉ vào ảnh chụp `active`.
          subscriber(5, { createdAt: daysAgo(90) }),
          // Ngoài cả hai kỳ ở CẢ HAI cột — không được lọt vào con số nào.
          subscriber(6, { createdAt: daysAgo(90), unsubscribedAt: daysAgo(70) }),
        ],
      });
    });

    it('created đếm theo createdAt ở CẢ HAI kỳ, kể cả địa chỉ sau đó đã huỷ', async () => {
      const stats = AdminSubscribersStatsSchema.parse(
        (await get('subscribers', adminCookie)).json(),
      );
      // Hàng 2 đăng ký trong kỳ rồi huỷ ngay trong kỳ: vẫn là một lượt đăng ký
      // của kỳ (lọc theo trạng thái hiện tại sẽ ra 1).
      expect(stats.created).toEqual({ current: 2, previous: 1 });
      expect(stats.period.windowDays).toBe(28);
    });

    it('unsubscribed đếm theo unsubscribedAt — cột KHÁC, hai kỳ độc lập với created', async () => {
      const stats = AdminSubscribersStatsSchema.parse(
        (await get('subscribers', adminCookie)).json(),
      );
      // Hàng 3 đăng ký kỳ TRƯỚC nhưng huỷ kỳ NÀY: hai metric không được đọc
      // chung một cột.
      expect(stats.unsubscribed).toEqual({ current: 2, previous: 1 });
    });

    it('active là ẢNH CHỤP unsubscribedAt null bây giờ, không phân biệt tuổi hàng', async () => {
      const stats = AdminSubscribersStatsSchema.parse(
        (await get('subscribers', adminCookie)).json(),
      );
      // Hàng 1 (đăng ký 3 ngày trước) + hàng 5 (90 ngày trước) — bốn hàng còn
      // lại đều đã có mốc rút consent.
      expect(stats.active).toBe(2);
      // Khớp ĐÚNG số hàng của `/subscribers?active=true` (lời hứa ở contract).
      expect(await prisma.subscriber.count({ where: { unsubscribedAt: null } })).toBe(2);
    });
  });

  describe('stats.subscribers — kỳ rỗng', () => {
    it('bảng trống: cặp 0/0 và ảnh chụp 0 — con số thật, không phải lỗi', async () => {
      const stats = AdminSubscribersStatsSchema.parse(
        (await get('subscribers', adminCookie)).json(),
      );
      expect(stats).toMatchObject({
        created: { current: 0, previous: 0 },
        unsubscribed: { current: 0, previous: 0 },
        active: 0,
      });
    });
  });
});
