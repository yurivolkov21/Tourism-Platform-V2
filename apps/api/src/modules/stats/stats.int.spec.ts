import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminBookingsStatsSchema,
  AdminCancellationsStatsSchema,
  AdminReviewsStatsSchema,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
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

  /** GET một endpoint stats với cookie cho sẵn. */
  async function get(path: string, cookie: string) {
    return app.inject({ method: 'GET', url: `/api/admin/stats/${path}`, headers: { cookie } });
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE tour_categories, destinations, users, payment_events, outbox CASCADE',
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
      'TRUNCATE TABLE bookings, refunds, cancellation_requests, reviews, review_moderation_events, outbox CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('guard — cùng lớp với bảy endpoint admin còn lại', () => {
    it('ẩn danh → 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/stats/bookings' });
      expect(res.statusCode).toBe(401);
    });

    it('khách thường → 403', async () => {
      const res = await get('bookings', customerCookie);
      expect(res.statusCode).toBe(403);
    });
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

      // 100 + 200 (booking 2 hoàn toàn có thể bị huỷ sau, tiền vẫn đã đi vào)
      expect(stats.revenue.current).toBe('300.00');
      expect(stats.revenue.previous).toBe('200.00');
    });

    it('paidBookings đếm ĐÚNG tập đã sinh ra revenue', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      expect(stats.paidBookings).toEqual({ current: 2, previous: 2 });
    });

    it('newBookings đếm theo createdAt, MỌI trạng thái', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      expect(stats.newBookings).toEqual({ current: 3, previous: 3 });
    });

    it('cancellationRate chỉ tính trên booking ĐÃ TRẢ TIỀN — checkout bỏ dở không phải huỷ', async () => {
      const stats = AdminBookingsStatsSchema.parse((await get('bookings', adminCookie)).json());
      // Kỳ này: 1 huỷ / 2 đã trả tiền. Kỳ trước: 0 / 2 — booking 6 CANCELLED
      // nhưng chưa từng trả tiền nên không nằm trong mẫu số lẫn tử số.
      expect(stats.cancellationRate).toEqual({ current: '50.0', previous: '0.0' });
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
        ],
      });
    });

    it('pending là ẢNH CHỤP hàng đợi: bây giờ so với lúc đầu kỳ', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      // Bây giờ: review 1, 2. Đầu kỳ: review 1, 3, 7 (đã gửi, chưa moderate
      // tại mốc ấy).
      expect(stats.pending).toEqual({ current: 2, previous: 3 });
    });

    it('approved đếm theo moderatedAt trong từng kỳ', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      expect(stats.approved).toEqual({ current: 3, previous: 1 });
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
  });

  describe('stats.reviews — kỳ rỗng', () => {
    it('không có review nào: đếm 0 và điểm trung bình null (không phải 0 sao)', async () => {
      const stats = AdminReviewsStatsSchema.parse((await get('reviews', adminCookie)).json());
      expect(stats.pending).toEqual({ current: 0, previous: 0 });
      expect(stats.averageRating).toEqual({ current: null, previous: null });
    });
  });
});
