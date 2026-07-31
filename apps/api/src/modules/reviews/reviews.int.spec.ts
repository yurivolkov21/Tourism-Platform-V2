import { randomUUID } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { BookingStatus, ReviewSource } from '../../generated/prisma/enums.js';
import { ReviewsService } from './reviews.service.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Chốt toàn bộ vòng đời review P3a-A W1: tạo → gate điều kiện → duyệt →
 * rating tour → list công khai — cả 8 bất biến đã liệt kê ở spec.
 */

const PASSWORD = 'password-123';
// vitest.int.config.ts set ADMIN_EMAILS='bootstrap-admin@tourism.test' —
// PHẢI dùng đúng giá trị này để hook bootstrap (create.after) tự promote
// user lên ADMIN. Email 'admin@tourism.test' chỉ là default của env.ts khi
// KHÔNG chạy dưới vitest.int.config.ts — dùng nhầm ở đây sẽ khiến mọi
// signUpAdmin() ra CUSTOMER thường, và call moderate() ăn 403 oan.
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';

let app: NestFastifyApplication;
let reviewsService: ReviewsService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    rawBody: true,
  });
  reviewsService = moduleRef.get(ReviewsService);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Thứ tự truncate theo chiều phụ thuộc FK.
  await prisma.$executeRawUnsafe(
    'TRUNCATE review_moderation_events, reviews, outbox, bookings, tour_departures, tours, tour_categories, destinations, users, sessions, accounts RESTART IDENTITY CASCADE',
  );
});

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

/** Đăng ký + đăng nhập một customer thường, trả về user row + cookie session. */
async function signUpAndSignIn(app: NestFastifyApplication, email: string) {
  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: PASSWORD, name: 'Test User' },
  });
  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email, password: PASSWORD },
  });
  const cookie = sessionCookie(signIn);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { user, cookie };
}

/**
 * Đăng ký một admin — email PHẢI nằm trong ADMIN_EMAILS để hook bootstrap
 * (create.after) tự promote lên ADMIN ngay lúc tạo (auth.int.spec.ts test b).
 */
async function signUpAdmin(app: NestFastifyApplication, email: string) {
  const result = await signUpAndSignIn(app, email);
  // ADR-0008: signup không còn auto-promote; test cần admin nên promote thẳng DB.
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN', emailVerified: true } });
  return result;
}

/** Dựng 1 tour + 1 departure đã kết thúc + 1 booking PAID của user cho sẵn. */
async function seedCompletedBooking(opts: { endDate: Date; userId: string }) {
  const category = await prisma.tourCategory.create({
    data: { slug: 'walking', name: 'Walking', order: 1 },
  });
  const destination = await prisma.destination.create({
    data: { slug: 'hoi-an', name: 'Hội An' },
  });
  const tour = await prisma.tour.create({
    data: {
      slug: 'hoi-an-lantern-evening',
      title: 'Hội An Old Town & Lantern Evening',
      categoryId: category.id,
      durationDays: 1,
      basePrice: '39.00',
      currency: 'USD',
      isPublished: true,
      destinations: { create: { destinationId: destination.id, isPrimary: true } },
    },
  });
  const departure = await prisma.tourDeparture.create({
    data: {
      tourId: tour.id,
      startDate: opts.endDate,
      endDate: opts.endDate,
      seatsTotal: 10,
      seatsBooked: 1,
    },
  });
  const booking = await prisma.booking.create({
    data: {
      code: 'BK-TESTREV1',
      userId: opts.userId,
      tourId: tour.id,
      departureId: departure.id,
      numAdults: 1,
      totalAmount: '39.00',
      currency: 'USD',
      status: BookingStatus.PAID,
      tourTitle: tour.title,
      departureStartDate: departure.startDate,
      departureEndDate: departure.endDate,
      unitPrice: '39.00',
      contactName: 'Test',
      contactEmail: 'test@example.com',
      paymentProvider: 'STRIPE',
    },
  });
  return { tour, departure, booking };
}

/** Tạo review VERIFIED qua API thật rồi duyệt luôn — dùng lại ở nhiều test. */
async function createAndApprove(app: NestFastifyApplication) {
  const { user, cookie } = await signUpAndSignIn(app, 'reviewer@example.com');
  await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: user.id });

  const created = await app.inject({
    method: 'POST',
    url: '/api/reviews',
    headers: { cookie },
    payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Rất đáng để trải nghiệm lần nữa' },
  });
  const reviewId = created.json().id;

  const admin = await signUpAdmin(app, ADMIN_EMAIL);
  await app.inject({
    method: 'POST',
    url: `/api/admin/reviews/${reviewId}/moderate`,
    headers: { cookie: admin.cookie },
    payload: { id: reviewId, approve: true },
  });

  return { reviewId, adminCookie: admin.cookie };
}

/** Một tour với 2 review ĐÃ DUYỆT: 1 thường + 1 authorDeleted. */
async function seedTwoApprovedReviews() {
  const category = await prisma.tourCategory.create({
    data: { slug: 'walking', name: 'Walking', order: 1 },
  });
  const destination = await prisma.destination.create({
    data: { slug: 'hoi-an', name: 'Hội An' },
  });
  const tour = await prisma.tour.create({
    data: {
      slug: 'hoi-an-lantern-evening',
      title: 'Hội An Old Town & Lantern Evening',
      categoryId: category.id,
      durationDays: 1,
      basePrice: '39.00',
      currency: 'USD',
      isPublished: true,
      destinations: { create: { destinationId: destination.id, isPrimary: true } },
    },
  });
  // CURATED (không phải VERIFIED): check constraint reviews_source_shape đòi
  // VERIFIED phải có đủ userId+bookingId thật; ở đây chỉ cần 2 row đã duyệt
  // gắn vào tour để test thứ tự sort, không cần user/booking thật.
  await prisma.review.create({
    data: {
      tourId: tour.id,
      source: ReviewSource.CURATED,
      rating: 5,
      body: 'Tuyệt vời, đáng đồng tiền bát gạo',
      authorName: 'Alice',
      isApproved: true,
    },
  });
  await prisma.review.create({
    data: {
      tourId: tour.id,
      source: ReviewSource.CURATED,
      rating: 4,
      body: 'Ổn, chắc chắn sẽ quay lại lần sau',
      authorName: 'Bob',
      authorDeleted: true,
      isApproved: true,
    },
  });
  return { tour };
}

describe('reviews (int)', () => {
  it('chuyến CHƯA kết thúc → REVIEW_TRIP_NOT_COMPLETED', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'a@example.com');
    const future = new Date(Date.now() + 30 * 864e5);
    await seedCompletedBooking({ endDate: future, userId: user.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Tuyệt vời quá đi mất' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('REVIEW_TRIP_NOT_COMPLETED');
    expect(await prisma.review.count()).toBe(0);
  });

  it('booking của người khác → 403 BOOKING_FORBIDDEN', async () => {
    const owner = await signUpAndSignIn(app, 'owner@example.com');
    const other = await signUpAndSignIn(app, 'other@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: owner.user.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie: other.cookie },
      payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Không phải booking của tôi' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('BOOKING_FORBIDDEN');
  });

  it('duyệt review: rating tour đổi ĐÚNG trong cùng transaction', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'c@example.com');
    const { tour } = await seedCompletedBooking({
      endDate: new Date(Date.now() - 864e5),
      userId: user.id,
    });
    const admin = await signUpAdmin(app, ADMIN_EMAIL);

    const created = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: { bookingCode: 'BK-TESTREV1', rating: 4, body: 'Hướng dẫn viên nhiệt tình' },
    });
    const reviewId = created.json().id;

    // Trước khi duyệt: rating chưa đổi.
    let fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
    expect(fresh.ratingAvg).toBeNull();
    expect(fresh.ratingCount).toBe(0);

    await app.inject({
      method: 'POST',
      url: `/api/admin/reviews/${reviewId}/moderate`,
      headers: { cookie: admin.cookie },
      payload: { id: reviewId, approve: true },
    });

    fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
    expect(Number(fresh.ratingAvg)).toBe(4);
    expect(fresh.ratingCount).toBe(1);
  });

  it('duyệt review: đúng 1 ReviewModerationEvent + đúng 1 outbox', async () => {
    const { reviewId } = await createAndApprove(app);

    expect(await prisma.reviewModerationEvent.count({ where: { reviewId } })).toBe(1);
    const event = await prisma.reviewModerationEvent.findFirstOrThrow({ where: { reviewId } });
    expect(event.fromApproved).toBe(false);
    expect(event.toApproved).toBe(true);

    expect(await prisma.outbox.count({ where: { dedupeKey: `review-approved:${reviewId}` } })).toBe(
      1,
    );
  });

  it('unapprove rồi approve lại → KHÔNG gửi mail lần hai', async () => {
    const { reviewId, adminCookie } = await createAndApprove(app);

    for (const approve of [false, true]) {
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${reviewId}/moderate`,
        headers: { cookie: adminCookie },
        payload: { id: reviewId, approve },
      });
    }

    // Outbox vẫn đúng 1 row — dedupeKey chặn gửi lại.
    expect(await prisma.outbox.count({ where: { dedupeKey: `review-approved:${reviewId}` } })).toBe(
      1,
    );
    // Nhưng lịch sử có đủ 3 sự kiện: approve → unapprove → approve.
    expect(await prisma.reviewModerationEvent.count({ where: { reviewId } })).toBe(3);
  });

  it('review CURATED CÓ tourId → duyệt CÓ tính vào rating của tour đó (quyết định 31/07)', async () => {
    // Đảo bất biến so với test cũ (trước 31/07): trước đây CURATED có tourId
    // được duyệt thì rating tour PHẢI đứng yên (gate ③ kiểm thêm
    // `source === VERIFIED`). Quyết định 31/07 bỏ điều kiện đó — capstone
    // không có khách thật, CURATED là nguồn sao DUY NHẤT, và seed/service
    // giờ dùng CHUNG một công thức (mọi review approved có tourId). Test này
    // giờ khẳng định NGƯỢC LẠI: duyệt CURATED CÓ tourId phải cập nhật rating.
    const admin = await signUpAdmin(app, ADMIN_EMAIL);
    const category = await prisma.tourCategory.create({
      data: { slug: 'walking', name: 'Walking', order: 1 },
    });
    const destination = await prisma.destination.create({
      data: { slug: 'hoi-an', name: 'Hội An' },
    });
    const tour = await prisma.tour.create({
      data: {
        slug: 'hoi-an-lantern-evening',
        title: 'Hội An Old Town & Lantern Evening',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: true,
        destinations: { create: { destinationId: destination.id, isPrimary: true } },
      },
    });
    const curated = await prisma.review.create({
      data: {
        tourId: tour.id,
        source: ReviewSource.CURATED,
        authorName: 'Marketing Team',
        rating: 5,
        body: 'Testimonial do admin viết, gắn vào tour để hiện trong trang tour',
        isApproved: false,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/reviews/${curated.id}/moderate`,
      headers: { cookie: admin.cookie },
      payload: { id: curated.id, approve: true },
    });

    expect(res.statusCode).toBe(200);
    // Rating của ĐÚNG tour đó ĐÃ đổi — CURATED có tourId giờ tính như VERIFIED.
    const fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
    expect(Number(fresh.ratingAvg)).toBe(5);
    expect(fresh.ratingCount).toBe(1);
  });

  it('list công khai: review khuyết danh xếp SAU review có danh tính', async () => {
    const { tour } = await seedTwoApprovedReviews(); // 1 thường + 1 authorDeleted

    const res = await app.inject({ method: 'GET', url: `/api/tours/${tour.slug}/reviews` });

    const items = res.json().items;
    expect(items).toHaveLength(2);
    expect(items[0].authorDeleted).toBe(false);
    expect(items[1].authorDeleted).toBe(true);
    expect(items[1].authorName).toBeNull(); // tên đã bị giấu
  });

  it('list công khai: review CHƯA duyệt (pending) KHÔNG xuất hiện', async () => {
    // Mutation-test đã chứng minh: xoá filter `isApproved: true` khỏi
    // `listByTour` thì 72/72 test cũ VẪN XANH — bề mặt bảo mật này trước đó
    // không có gì canh. Test này PHẢI fail nếu ai đó gỡ filter đó ra.
    const category = await prisma.tourCategory.create({
      data: { slug: 'walking', name: 'Walking', order: 1 },
    });
    const destination = await prisma.destination.create({
      data: { slug: 'hoi-an', name: 'Hội An' },
    });
    const tour = await prisma.tour.create({
      data: {
        slug: 'hoi-an-lantern-evening',
        title: 'Hội An Old Town & Lantern Evening',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: true,
        destinations: { create: { destinationId: destination.id, isPrimary: true } },
      },
    });
    const approved = await prisma.review.create({
      data: {
        tourId: tour.id,
        source: ReviewSource.CURATED,
        rating: 5,
        body: 'Review đã duyệt, phải xuất hiện trong list công khai',
        authorName: 'Alice',
        isApproved: true,
      },
    });
    await prisma.review.create({
      data: {
        tourId: tour.id,
        source: ReviewSource.CURATED,
        rating: 1,
        body: 'Review CHƯA duyệt, KHÔNG được lộ ra ngoài công khai',
        authorName: 'Mallory',
        isApproved: false,
      },
    });

    const res = await app.inject({ method: 'GET', url: `/api/tours/${tour.slug}/reviews` });

    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(approved.id);
    expect(res.json().total).toBe(1);
  });

  it('KHÔNG có dữ liệu trust giả: tour chưa có review → ratingAvg null, list rỗng', async () => {
    // Regression có chủ đích: Nexora từng hiện 4 reviewer bịa (Emily Carter…)
    // khi chưa có review thật, phải gỡ rồi viết test chặn nó sống lại.
    const admin = await signUpAdmin(app, ADMIN_EMAIL);
    const { tour } = await seedCompletedBooking({
      endDate: new Date(Date.now() - 864e5),
      userId: admin.user.id,
    });

    const res = await app.inject({ method: 'GET', url: `/api/tours/${tour.slug}/reviews` });

    expect(res.json().items).toEqual([]);
    expect(res.json().total).toBe(0);
    const fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
    expect(fresh.ratingAvg).toBeNull();
    expect(fresh.ratingCount).toBe(0);
  });

  it('list công khai: slug lạ → TOUR_NOT_FOUND', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tours/khong-ton-tai/reviews' });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('TOUR_NOT_FOUND');
  });

  it('list công khai: tour có isPublished=false → TOUR_NOT_FOUND', async () => {
    // Nửa còn lại của tên test cũ ('tour chưa publish hoặc slug lạ') chưa
    // từng chạy — mutation-test đã chứng minh xoá filter `isPublished: true`
    // khỏi `listByTour` thì 72/72 test cũ VẪN XANH. Test này PHẢI fail nếu
    // filter đó bị gỡ.
    const category = await prisma.tourCategory.create({
      data: { slug: 'walking', name: 'Walking', order: 1 },
    });
    const tour = await prisma.tour.create({
      data: {
        slug: 'chua-xuat-ban',
        title: 'Tour chưa xuất bản',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: false,
      },
    });

    const res = await app.inject({ method: 'GET', url: `/api/tours/${tour.slug}/reviews` });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('TOUR_NOT_FOUND');
  });

  it(
    'duyệt 2 review KHÁC NHAU của CÙNG tour, chạy SONG SONG → ' +
      'không mất update rating (bất biến chốt lại của Task 5)',
    async () => {
      const owner1 = await signUpAndSignIn(app, 'race1@example.com');
      const owner2 = await signUpAndSignIn(app, 'race2@example.com');
      const admin = await signUpAdmin(app, ADMIN_EMAIL);

      // Dựng tay 1 tour + 2 booking KHÁC NHAU (seedCompletedBooking() hard-code
      // một mã booking, không dùng lại được cho 2 review cùng lúc ở đây).
      const category = await prisma.tourCategory.create({
        data: { slug: 'walking', name: 'Walking', order: 1 },
      });
      const destination = await prisma.destination.create({
        data: { slug: 'hoi-an', name: 'Hội An' },
      });
      const tour = await prisma.tour.create({
        data: {
          slug: 'hoi-an-lantern-evening',
          title: 'Hội An Old Town & Lantern Evening',
          categoryId: category.id,
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: true,
          destinations: { create: { destinationId: destination.id, isPrimary: true } },
        },
      });
      const endDate = new Date(Date.now() - 864e5);
      const departure = await prisma.tourDeparture.create({
        data: { tourId: tour.id, startDate: endDate, endDate, seatsTotal: 10, seatsBooked: 2 },
      });
      const makeBooking = (code: string, userId: string) =>
        prisma.booking.create({
          data: {
            code,
            userId,
            tourId: tour.id,
            departureId: departure.id,
            numAdults: 1,
            totalAmount: '39.00',
            currency: 'USD',
            status: BookingStatus.PAID,
            tourTitle: tour.title,
            departureStartDate: departure.startDate,
            departureEndDate: departure.endDate,
            unitPrice: '39.00',
            contactName: 'Test',
            contactEmail: 'test@example.com',
            paymentProvider: 'STRIPE',
          },
        });
      await makeBooking('BK-RACE0001', owner1.user.id);
      await makeBooking('BK-RACE0002', owner2.user.id);

      const review1 = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: { cookie: owner1.cookie },
        payload: { bookingCode: 'BK-RACE0001', rating: 4, body: 'Trải nghiệm rất tốt, đáng nhớ' },
      });
      const review2 = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: { cookie: owner2.cookie },
        payload: { bookingCode: 'BK-RACE0002', rating: 2, body: 'Bình thường, không đặc sắc lắm' },
      });
      const id1 = review1.json().id;
      const id2 = review2.json().id;

      // Song song THẬT trên Postgres thật — gọi thẳng ReviewsService.moderate()
      // (không qua app.inject) để chắc chắn 2 transaction chồng nhau, không bị
      // hàng đợi ẩn nào của lớp HTTP làm tuần tự hoá.
      await Promise.all([
        reviewsService.moderate(admin.user.id, { id: id1, approve: true }),
        reviewsService.moderate(admin.user.id, { id: id2, approve: true }),
      ]);

      const fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
      expect(fresh.ratingCount).toBe(2);
      expect(Number(fresh.ratingAvg)).toBe(3); // (4 + 2) / 2 = 3, không lệch do lost update
    },
  );

  describe('reviews.mine', () => {
    /** Booking + tour riêng cho từng review — tránh đụng unique(code)/slug khi
     * một test cần nhiều review cho CÙNG một user. */
    async function seedOwnBooking(opts: { userId: string; code: string; tourSlug: string }) {
      const category = await prisma.tourCategory.create({
        data: { slug: `cat-${opts.tourSlug}`, name: 'Walking', order: 1 },
      });
      const destination = await prisma.destination.create({
        data: { slug: `dest-${opts.tourSlug}`, name: 'Hội An' },
      });
      const endDate = new Date(Date.now() - 864e5);
      const tour = await prisma.tour.create({
        data: {
          slug: opts.tourSlug,
          title: 'Hội An Old Town & Lantern Evening',
          categoryId: category.id,
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: true,
          destinations: { create: { destinationId: destination.id, isPrimary: true } },
        },
      });
      const departure = await prisma.tourDeparture.create({
        data: { tourId: tour.id, startDate: endDate, endDate, seatsTotal: 10, seatsBooked: 1 },
      });
      await prisma.booking.create({
        data: {
          code: opts.code,
          userId: opts.userId,
          tourId: tour.id,
          departureId: departure.id,
          numAdults: 1,
          totalAmount: '39.00',
          currency: 'USD',
          status: BookingStatus.PAID,
          tourTitle: tour.title,
          departureStartDate: departure.startDate,
          departureEndDate: departure.endDate,
          unitPrice: '39.00',
          contactName: 'Test',
          contactEmail: 'test@example.com',
          paymentProvider: 'STRIPE',
        },
      });
      return { tour };
    }

    /** Viết review qua API thật cho booking `code` bằng cookie của chính chủ. */
    async function writeReview(cookie: string, code: string, rating: number, body: string) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: { cookie },
        payload: { bookingCode: code, rating, body },
      });
      return res.json().id as string;
    }

    it('trả đúng review của chính mình, KHÔNG lẫn review của user khác', async () => {
      const mine = await signUpAndSignIn(app, 'mine-owner@example.com');
      const other = await signUpAndSignIn(app, 'mine-other@example.com');
      await seedOwnBooking({ userId: mine.user.id, code: 'BK-MINE0001', tourSlug: 'walk-mine-1' });
      await seedOwnBooking({
        userId: other.user.id,
        code: 'BK-OTHR0001',
        tourSlug: 'walk-other-1',
      });
      const myReviewId = await writeReview(mine.cookie, 'BK-MINE0001', 5, 'Review của chính tôi');
      await writeReview(other.cookie, 'BK-OTHR0001', 3, 'Review của người khác, không liên quan');

      const res = await app.inject({
        method: 'GET',
        url: '/api/reviews/mine',
        headers: { cookie: mine.cookie },
      });

      expect(res.statusCode).toBe(200);
      const items = res.json().items;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(myReviewId);
      // Review vừa tạo chưa được admin duyệt.
      expect(items[0].isApproved).toBe(false);
      // R1: danh tính tour đi kèm — trang "Đánh giá của tôi" hiện tên + link.
      expect(items[0].tourSlug).toBe('walk-mine-1');
      expect(items[0].tourTitle).toBe('Hội An Old Town & Lantern Evening');
    });

    it('có cả review CHƯA duyệt của chính mình (mới nhất trước)', async () => {
      const { user, cookie } = await signUpAndSignIn(app, 'mine-pending@example.com');
      await seedOwnBooking({ userId: user.id, code: 'BK-MINE0002', tourSlug: 'walk-mine-2' });
      await seedOwnBooking({ userId: user.id, code: 'BK-MINE0003', tourSlug: 'walk-mine-3' });

      const firstId = await writeReview(cookie, 'BK-MINE0002', 4, 'Review đầu tiên, chưa duyệt');
      // Duyệt review thứ hai để chắc chắn mine KHÔNG lọc theo isApproved.
      const secondId = await writeReview(cookie, 'BK-MINE0003', 5, 'Review thứ hai, đã được duyệt');
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${secondId}/moderate`,
        headers: { cookie: admin.cookie },
        payload: { id: secondId, approve: true },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/reviews/mine',
        headers: { cookie },
      });

      const items = res.json().items;
      expect(items).toHaveLength(2);
      // Mới nhất trước → review thứ hai (đã duyệt) lên đầu.
      expect(items[0].id).toBe(secondId);
      expect(items[1].id).toBe(firstId);
      // isApproved đúng cho cả hai — mine() KHÔNG lọc theo isApproved nhưng
      // output PHẢI phân biệt được review nào đã lên trang tour.
      expect(items[0].isApproved).toBe(true);
      expect(items[1].isApproved).toBe(false);
    });

    it('gọi ẩn danh → 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/reviews/mine' });
      expect(res.statusCode).toBe(401);
    });

    it('phân trang đúng: field `limit` (không phải `pageSize`) trong output', async () => {
      const { user, cookie } = await signUpAndSignIn(app, 'mine-paged@example.com');
      await seedOwnBooking({ userId: user.id, code: 'BK-PAGE0001', tourSlug: 'walk-page-1' });
      await seedOwnBooking({ userId: user.id, code: 'BK-PAGE0002', tourSlug: 'walk-page-2' });
      await seedOwnBooking({ userId: user.id, code: 'BK-PAGE0003', tourSlug: 'walk-page-3' });
      await writeReview(cookie, 'BK-PAGE0001', 3, 'Review phân trang thứ nhất');
      await writeReview(cookie, 'BK-PAGE0002', 4, 'Review phân trang thứ hai');
      await writeReview(cookie, 'BK-PAGE0003', 5, 'Review phân trang thứ ba');

      const page1 = await app.inject({
        method: 'GET',
        url: '/api/reviews/mine?page=1&pageSize=2',
        headers: { cookie },
      });
      const body1 = page1.json();
      expect(body1.items).toHaveLength(2);
      expect(body1.limit).toBe(2);
      expect(body1.total).toBe(3);
      expect(body1.totalPages).toBe(2);
      expect(body1.pageSize).toBeUndefined();
      // Chưa admin nào duyệt trong test này → cả trang đều isApproved false.
      expect(body1.items[0].isApproved).toBe(false);
      expect(body1.items[1].isApproved).toBe(false);

      const page2 = await app.inject({
        method: 'GET',
        url: '/api/reviews/mine?page=2&pageSize=2',
        headers: { cookie },
      });
      expect(page2.json().items).toHaveLength(1);
    });
  });

  describe('admin reviews — phân quyền + adminList', () => {
    // Mutation-test đã chứng minh: xoá `@Roles(UserRole.ADMIN)` khỏi
    // AdminReviewsController thì 72/72 test cũ VẪN XANH, và `adminList`
    // không có test nào canh — bề mặt admin coi như KHÔNG có gì bảo vệ. Ba
    // test dưới đây PHẢI fail nếu guard/filter tương ứng bị gỡ.

    it('moderate: customer đã đăng nhập (không phải admin) → 403', async () => {
      const { cookie } = await signUpAndSignIn(app, 'not-admin@example.com');
      const fakeId = randomUUID(); // guard chạy TRƯỚC oRPC parse input → id không cần tồn tại thật.

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${fakeId}/moderate`,
        headers: { cookie },
        payload: { id: fakeId, approve: true },
      });

      expect(res.statusCode).toBe(403);
    });

    it('moderate: ẩn danh (không cookie) → 401', async () => {
      const fakeId = randomUUID();

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${fakeId}/moderate`,
        payload: { id: fakeId, approve: true },
      });

      expect(res.statusCode).toBe(401);
    });

    it('adminList: lọc theo isApproved hoạt động đúng', async () => {
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const category = await prisma.tourCategory.create({
        data: { slug: 'walking', name: 'Walking', order: 1 },
      });
      const tour = await prisma.tour.create({
        data: {
          slug: 'hoi-an-lantern-evening',
          title: 'Hội An Old Town & Lantern Evening',
          categoryId: category.id,
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: true,
        },
      });
      const approved = await prisma.review.create({
        data: {
          tourId: tour.id,
          source: ReviewSource.CURATED,
          rating: 5,
          body: 'Review đã duyệt, phải nằm trong kết quả isApproved=true',
          authorName: 'Alice',
          isApproved: true,
        },
      });
      const pending = await prisma.review.create({
        data: {
          tourId: tour.id,
          source: ReviewSource.CURATED,
          rating: 2,
          body: 'Review đang chờ duyệt, phải nằm trong kết quả isApproved=false',
          authorName: 'Bob',
          isApproved: false,
        },
      });

      const approvedOnly = await app.inject({
        method: 'GET',
        url: '/api/admin/reviews?isApproved=true',
        headers: { cookie: admin.cookie },
      });
      expect(approvedOnly.statusCode).toBe(200);
      const approvedItems = approvedOnly.json().items;
      expect(approvedItems).toHaveLength(1);
      expect(approvedItems[0].id).toBe(approved.id);

      const pendingOnly = await app.inject({
        method: 'GET',
        url: '/api/admin/reviews?isApproved=false',
        headers: { cookie: admin.cookie },
      });
      expect(pendingOnly.statusCode).toBe(200);
      const pendingItems = pendingOnly.json().items;
      expect(pendingItems).toHaveLength(1);
      expect(pendingItems[0].id).toBe(pending.id);

      // Không truyền isApproved → thấy CẢ hai (mặc định không lọc).
      const all = await app.inject({
        method: 'GET',
        url: '/api/admin/reviews',
        headers: { cookie: admin.cookie },
      });
      expect(all.json().items).toHaveLength(2);
    });

    it('adminList: lọc source/rating + search + trả moderatedBy/tourTitle (R2)', async () => {
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const adminRow = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
      const category = await prisma.tourCategory.create({
        data: { slug: 'r2-cat', name: 'R2', order: 1 },
      });
      const tour = await prisma.tour.create({
        data: {
          slug: 'r2-tour',
          title: 'R2 Heritage Tour',
          categoryId: category.id,
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: true,
        },
      });
      // Hai review CURATED (VERIFIED cần booking/user thật — CHECK
      // reviews_source_shape). Source filter vẫn discriminate qua ?source=VERIFIED→0.
      const fiveStar = await prisma.review.create({
        data: {
          tourId: tour.id,
          source: ReviewSource.CURATED,
          rating: 5,
          body: 'Chuyến đi tuyệt vời đáng nhớ',
          authorName: 'Alice Reviewer',
          isApproved: false,
        },
      });
      const twoStar = await prisma.review.create({
        data: {
          tourId: tour.id,
          source: ReviewSource.CURATED,
          rating: 2,
          body: 'Bình thường không đặc sắc',
          authorName: 'Bob Reviewer',
          isApproved: false,
        },
      });

      const get = (qs: string) =>
        app.inject({
          method: 'GET',
          url: `/api/admin/reviews${qs}`,
          headers: { cookie: admin.cookie },
        });

      // Lọc source: không có VERIFIED nào → rỗng; CURATED → cả hai (filter được áp).
      expect((await get('?source=VERIFIED')).json().items).toHaveLength(0);
      expect((await get('?source=CURATED')).json().items).toHaveLength(2);
      // Lọc rating → chỉ review 2 sao.
      expect((await get('?rating=2')).json().items.map((r: { id: string }) => r.id)).toEqual([
        twoStar.id,
      ]);
      // Search (không phân biệt hoa thường) khớp tên tác giả.
      expect((await get('?search=alice')).json().items.map((r: { id: string }) => r.id)).toEqual([
        fiveStar.id,
      ]);

      // tourTitle hiện; moderatedBy null khi chưa duyệt.
      const items = (await get('')).json().items as {
        tourTitle: string;
        moderatedBy: string | null;
      }[];
      expect(items.every((r) => r.tourTitle === 'R2 Heritage Tour')).toBe(true);
      expect(items.every((r) => r.moderatedBy === null)).toBe(true);

      // Sau khi duyệt → moderatedBy = tên admin ra quyết định.
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${twoStar.id}/moderate`,
        headers: { cookie: admin.cookie },
        payload: { id: twoStar.id, approve: true },
      });
      const moderated = (await get('?isApproved=true'))
        .json()
        .items.find((r: { id: string }) => r.id === twoStar.id);
      expect(moderated.moderatedBy).toBe(adminRow.name);
    });
  });
});
