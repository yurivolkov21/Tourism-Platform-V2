import { randomUUID } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { ContractOutputs } from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import {
  BookingStatus,
  EmailType,
  MediaOwnerType,
  MediaRole,
  MediaType,
  ReviewSource,
} from '../../generated/prisma/enums.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
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
let webRevalidationService: WebRevalidationService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    rawBody: true,
  });
  reviewsService = moduleRef.get(ReviewsService);
  webRevalidationService = moduleRef.get(WebRevalidationService);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Thứ tự truncate theo chiều phụ thuộc FK.
  await prisma.$executeRawUnsafe(
    'TRUNCATE media_assets, review_moderation_events, reviews, outbox, bookings, tour_departures, tours, tour_categories, destinations, users, sessions, accounts RESTART IDENTITY CASCADE',
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

/**
 * Trợ giúp gọi `GET /api/tours/:tourSlug/reviews` với query object, mô phỏng
 * hình dạng lệnh gọi client oRPC (`client.reviews.byTour({...})`) cho test dễ
 * đọc — repo CHƯA có oRPC test client dùng chung nên bọc quanh `app.inject`
 * đang dùng khắp file này, giữ nguyên đường HTTP thật thay vì gọi thẳng
 * service (test phải đi qua contract + controller như request thật).
 */
const client = {
  reviews: {
    async byTour(query: {
      tourSlug: string;
      page?: number;
      pageSize?: number;
      sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
      rating?: number;
      withPhotos?: boolean;
    }): Promise<ContractOutputs['reviews']['listByTour']> {
      const { tourSlug, ...rest } = query;
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) qs.set(key, String(value));
      }
      const suffix = qs.toString();
      const res = await app.inject({
        method: 'GET',
        url: `/api/tours/${tourSlug}/reviews${suffix ? `?${suffix}` : ''}`,
      });
      return res.json() as ContractOutputs['reviews']['listByTour'];
    },
  },
};

/** Đăng ký + đăng nhập một customer thường, trả về user row + cookie session. */
async function signUpAndSignIn(app: NestFastifyApplication, email: string) {
  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: PASSWORD, name: 'Test User' },
  });
  // requireEmailVerification (siết 20/08): verify qua DB trước khi đăng nhập.
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
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
    payload: { id: reviewId, verdict: 'approve' },
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

/**
 * Một tour với 5 review đã duyệt trải đủ 5 mức sao + 1 review 5 sao của tài
 * khoản đã xoá + ảnh gắn vào ĐÚNG MỘT review — đủ dữ liệu để phủ sort/rating
 * filter/withPhotos filter/breakdown trong một lần seed.
 *
 * Thứ tự tạo CỐ Ý xáo trộn (3,1,5,2,4 thay vì 1..5) — nếu tạo tăng dần theo
 * sao thì `createdAt DESC` mặc định (chưa cài sort) TÌNH CỜ trùng với thứ tự
 * `sort=highest`, khiến test RED giả (xanh dù tính năng chưa viết).
 */
async function seedReviewsAcrossRatings() {
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

  const ratings = [3, 1, 5, 2, 4];
  const reviews: { id: string; rating: number }[] = [];
  for (const rating of ratings) {
    const review = await prisma.review.create({
      data: {
        tourId: tour.id,
        source: ReviewSource.CURATED,
        rating,
        body: `Review ${rating} sao cho bài test sort/filter/breakdown`,
        authorName: `Reviewer ${rating}`,
        isApproved: true,
      },
    });
    reviews.push(review);
  }

  // Review 5 sao của tài khoản đã xoá — luật sản phẩm bắt buộc rơi xuống
  // cuối bất kể sort kiểu gì (kể cả sort=highest đáng lẽ đẩy nó lên đầu).
  await prisma.review.create({
    data: {
      tourId: tour.id,
      source: ReviewSource.CURATED,
      rating: 5,
      body: 'Review 5 sao của tài khoản đã bị xoá',
      authorName: 'Ghost',
      authorDeleted: true,
      isApproved: true,
    },
  });

  // Gắn ảnh vào ĐÚNG review 5 sao còn danh tính — withPhotos=true chỉ được
  // trả về đúng MỘT review này.
  const withPhotoReview = reviews.find((r) => r.rating === 5);
  if (!withPhotoReview) throw new Error('seed thiếu review 5 sao để gắn ảnh');
  await prisma.mediaAsset.create({
    data: {
      publicId: `tourism/reviews/sort-filter/${withPhotoReview.id}`,
      type: MediaType.IMAGE,
      ownerType: MediaOwnerType.REVIEW,
      ownerId: withPhotoReview.id,
      role: MediaRole.gallery,
      sortOrder: 0,
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

  it('photos hợp lệ → review kèm media, URL dựng từ publicId, đúng thứ tự gửi lên', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'photos-ok@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: user.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: {
        bookingCode: 'BK-TESTREV1',
        rating: 5,
        body: 'Great trip with lovely photos!',
        photos: ['tourism/reviews/BK-TESTREV1/pid-b', 'tourism/reviews/BK-TESTREV1/pid-a'],
      },
    });

    expect(res.statusCode).toBe(200);
    const media = res.json().media;
    // Thứ tự phải khớp NGUYÊN mảng gửi lên (pid-b trước pid-a) — sortOrder
    // ghi theo vị trí trong mảng lúc tạo, resolveForOwners sort lại theo đó.
    expect(media.map((m: { publicId: string }) => m.publicId)).toEqual([
      'tourism/reviews/BK-TESTREV1/pid-b',
      'tourism/reviews/BK-TESTREV1/pid-a',
    ]);
    expect(media[0].url).toContain('/image/upload/');
    expect(media[0].role).toBe('gallery');
  });

  it('photos trùng publicId (khách bấm gửi 2 lần cùng ảnh) → 200, dedupe còn 1 media', async () => {
    // Contract cho phép publicId trùng nhau trong mảng photos; MediaAsset có
    // @@unique([ownerType, ownerId, publicId]) nên createMany với publicId
    // trùng ném P2002 — catch bọc ngoài từng map NHẦM mọi P2002 thành
    // ReviewAlreadyExistsError (409) dù review đã rollback. Dedupe TRƯỚC
    // insert để P2002 chỉ còn nghĩa "unique(bookingId)" đúng như catch dự tính.
    const { user, cookie } = await signUpAndSignIn(app, 'photos-dup@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: user.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: {
        bookingCode: 'BK-TESTREV1',
        rating: 5,
        body: 'Gửi trùng publicId do double-click nút Đăng',
        photos: ['tourism/reviews/BK-TESTREV1/pid-same', 'tourism/reviews/BK-TESTREV1/pid-same'],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().media).toHaveLength(1);
  });

  it('photos trỏ folder booking KHÁC → 400 REVIEW_PHOTO_INVALID, không tạo review lẫn asset', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'photos-smuggle@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: user.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: {
        bookingCode: 'BK-TESTREV1',
        rating: 5,
        body: 'Photo smuggling attempt!',
        photos: ['tourism/reviews/BK-KHAC9999/pid-x'],
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('REVIEW_PHOTO_INVALID');
    expect(await prisma.review.count()).toBe(0);
    expect(await prisma.mediaAsset.count()).toBe(0);
  });

  it('không gửi photos → media rỗng (không vỡ hợp đồng cũ)', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'photos-none@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: user.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Không có ảnh đính kèm gì cả' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().media).toEqual([]);
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
      payload: { id: reviewId, verdict: 'approve' },
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

  it('moderate trạng-thái-trùng là NO-OP: không ghi đè moderatedBy, không event rác (review F4 31/08)', async () => {
    // Khoá chống tái hiện: tab cũ của admin B bấm approve lên review admin A
    // đã duyệt — trước đây server ghi đè moderatedBy thành B (người không
    // quyết gì) và đẩy event from===to vào audit trail append-only.
    const { reviewId } = await createAndApprove(app);
    const before = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });

    const second = await signUpAdmin(app, 'second-admin@tourism.test');
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/reviews/${reviewId}/moderate`,
      headers: { cookie: second.cookie },
      payload: { id: reviewId, verdict: 'approve' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().isApproved).toBe(true); // trả trạng thái hiện tại

    const after = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
    expect(after.moderatedById).toBe(before.moderatedById); // vẫn là A
    expect(after.moderatedAt?.toISOString()).toBe(before.moderatedAt?.toISOString());
    expect(await prisma.reviewModerationEvent.count({ where: { reviewId } })).toBe(1);
  });

  it('duyệt review của tài khoản ĐÃ XOÁ (tombstone) → KHÔNG xếp email (review F4 31/08)', async () => {
    // Xoá tài khoản là soft-delete: email thành deleted+…@tombstone.local —
    // gửi vào đó là bounce vĩnh viễn; UI cũng hứa "No email goes out".
    const { user, cookie } = await signUpAndSignIn(app, 'tombstone-author@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: user.id });
    const created = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Review trước khi xoá tài khoản' },
    });
    const reviewId = created.json().id;
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), email: `deleted+${randomUUID()}@tombstone.local` },
    });

    const admin = await signUpAdmin(app, ADMIN_EMAIL);
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/reviews/${reviewId}/moderate`,
      headers: { cookie: admin.cookie },
      payload: { id: reviewId, verdict: 'approve' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().isApproved).toBe(true); // duyệt vẫn ăn — chỉ email là không
    expect(await prisma.outbox.count({ where: { dedupeKey: `review-approved:${reviewId}` } })).toBe(
      0,
    );
  });

  it('unpublish rồi approve lại → KHÔNG gửi mail lần hai', async () => {
    const { reviewId, adminCookie } = await createAndApprove(app);

    for (const verdict of ['unpublish', 'approve'] as const) {
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${reviewId}/moderate`,
        headers: { cookie: adminCookie },
        payload: { id: reviewId, verdict },
      });
    }

    // Outbox vẫn đúng 1 row — dedupeKey chặn gửi lại.
    expect(await prisma.outbox.count({ where: { dedupeKey: `review-approved:${reviewId}` } })).toBe(
      1,
    );
    // Nhưng lịch sử có đủ 3 sự kiện: approve → unpublish → approve.
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
      payload: { id: curated.id, verdict: 'approve' },
    });

    expect(res.statusCode).toBe(200);
    // Rating của ĐÚNG tour đó ĐÃ đổi — CURATED có tourId giờ tính như VERIFIED.
    const fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
    expect(Number(fresh.ratingAvg)).toBe(5);
    expect(fresh.ratingCount).toBe(1);
  });

  it('list công khai: review approved kèm ảnh → item có media.length === 1', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'listbytour-media@example.com');
    const { tour } = await seedCompletedBooking({
      endDate: new Date(Date.now() - 864e5),
      userId: user.id,
    });

    const created = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: {
        bookingCode: 'BK-TESTREV1',
        rating: 5,
        body: 'Ảnh chuyến đi rất đẹp, đáng lưu lại',
        photos: ['tourism/reviews/BK-TESTREV1/pid-only'],
      },
    });
    const reviewId = created.json().id;

    const admin = await signUpAdmin(app, ADMIN_EMAIL);
    await app.inject({
      method: 'POST',
      url: `/api/admin/reviews/${reviewId}/moderate`,
      headers: { cookie: admin.cookie },
      payload: { id: reviewId, verdict: 'approve' },
    });

    const res = await app.inject({ method: 'GET', url: `/api/tours/${tour.slug}/reviews` });

    const items = res.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].media).toHaveLength(1);
    expect(items[0].media[0].publicId).toBe('tourism/reviews/BK-TESTREV1/pid-only');
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
        reviewsService.moderate(admin.user.id, { id: id1, verdict: 'approve' }),
        reviewsService.moderate(admin.user.id, { id: id2, verdict: 'approve' }),
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
        payload: { id: secondId, verdict: 'approve' },
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
        payload: { id: fakeId, verdict: 'approve' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('moderate: ẩn danh (không cookie) → 401', async () => {
      const fakeId = randomUUID();

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${fakeId}/moderate`,
        payload: { id: fakeId, verdict: 'approve' },
      });

      expect(res.statusCode).toBe(401);
    });

    /**
     * ADR-0031 — ba động từ, và điều phân biệt chúng nằm ở HAI chỗ: hàng đợi
     * còn giữ review không, và khách có được báo không.
     */
    describe('moderate: reject / unpublish (ADR-0031)', () => {
      /** Một review CURATED chờ duyệt, không cần booking/user thật. */
      async function seedPending(slug: string) {
        const category = await prisma.tourCategory.create({
          data: { slug: `${slug}-cat`, name: slug, order: 1 },
        });
        const tour = await prisma.tour.create({
          data: {
            slug: `${slug}-tour`,
            title: `${slug} Tour`,
            categoryId: category.id,
            durationDays: 1,
            basePrice: '39.00',
            currency: 'USD',
            isPublished: true,
          },
        });
        return prisma.review.create({
          data: {
            tourId: tour.id,
            source: ReviewSource.CURATED,
            rating: 4,
            body: 'Một review chờ duyệt, đủ dài để trông như thật.',
            authorName: 'Range Author',
            isApproved: false,
          },
        });
      }

      it('reject: ghi rejected_at + rejected_by, và review RỜI hàng đợi', async () => {
        const admin = await signUpAdmin(app, ADMIN_EMAIL);
        const review = await seedPending('rej');

        await reviewsService.moderate(admin.user.id, {
          id: review.id,
          verdict: 'reject',
          note: 'Không nói về chuyến đi.',
        });

        const after = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
        expect(after.isApproved).toBe(false);
        expect(after.rejectedAt).not.toBeNull();
        expect(after.rejectedById).toBe(admin.user.id);
        // Đây là cả điểm của ADR: hàng đợi dọn sạch được.
        expect(await prisma.review.count({ where: { isApproved: false, rejectedAt: null } })).toBe(
          0,
        );
      });

      it('reject ghi audit `to_rejected` — `to_approved = false` một mình không phân biệt được với unpublish', async () => {
        const admin = await signUpAdmin(app, ADMIN_EMAIL);
        const review = await seedPending('audit');

        await reviewsService.moderate(admin.user.id, { id: review.id, verdict: 'reject' });

        const [event] = await prisma.reviewModerationEvent.findMany({
          where: { reviewId: review.id },
        });
        expect(event?.toApproved).toBe(false);
        expect(event?.toRejected).toBe(true);
      });

      it('unpublish một review ĐANG BỊ BÁC là một thay đổi THẬT, không phải no-op', async () => {
        // Cả hai trạng thái đều `is_approved = false`, nên guard so theo mỗi
        // cột ấy sẽ nuốt lệnh và review kẹt vĩnh viễn ngoài hàng đợi.
        const admin = await signUpAdmin(app, ADMIN_EMAIL);
        const review = await seedPending('back');
        await reviewsService.moderate(admin.user.id, { id: review.id, verdict: 'reject' });

        await reviewsService.moderate(admin.user.id, { id: review.id, verdict: 'unpublish' });

        const after = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
        expect(after.rejectedAt).toBeNull();
        expect(await prisma.reviewModerationEvent.count({ where: { reviewId: review.id } })).toBe(
          2,
        );
      });

      it('approve XOÁ rejected_at — không thì CHECK của DB nổ', async () => {
        // `reviews_verdict_shape` cấm "vừa đăng vừa bị bác". Test này canh
        // rằng nhánh approve dọn dấu vết cũ chứ không để DB chặn giữa chừng.
        const admin = await signUpAdmin(app, ADMIN_EMAIL);
        const review = await seedPending('undo');
        await reviewsService.moderate(admin.user.id, { id: review.id, verdict: 'reject' });

        await reviewsService.moderate(admin.user.id, { id: review.id, verdict: 'approve' });

        const after = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
        expect(after.isApproved).toBe(true);
        expect(after.rejectedAt).toBeNull();
      });

      it('DB CHẶN trạng thái vô nghĩa "vừa đăng vừa bị bác"', async () => {
        // Bất biến do CHECK canh, không do code nhớ (ADR-0031 §1) — nên nó
        // vẫn đứng khi một nhánh code nào đó về sau quên.
        const review = await seedPending('check');
        await expect(
          prisma.review.update({
            where: { id: review.id },
            data: { isApproved: true, rejectedAt: new Date() },
          }),
        ).rejects.toThrow();
      });

      it('lọc `state=rejected` trả đúng review bị bác; `state=pending` KHÔNG có nó', async () => {
        const admin = await signUpAdmin(app, ADMIN_EMAIL);
        const rejected = await seedPending('filter-a');
        const pending = await seedPending('filter-b');
        await reviewsService.moderate(admin.user.id, { id: rejected.id, verdict: 'reject' });

        const ids = async (qs: string) => {
          const res = await app.inject({
            method: 'GET',
            url: `/api/admin/reviews${qs}`,
            headers: { cookie: admin.cookie },
          });
          return (res.json().items as { id: string }[]).map((r) => r.id);
        };

        expect(await ids('?state=rejected')).toEqual([rejected.id]);
        expect(await ids('?state=pending')).toEqual([pending.id]);
      });

      it('review bị bác mang theo LÝ DO ra admin (note của quyết định gần nhất)', async () => {
        const admin = await signUpAdmin(app, ADMIN_EMAIL);
        const review = await seedPending('reason');
        await reviewsService.moderate(admin.user.id, {
          id: review.id,
          verdict: 'reject',
          note: 'Nội dung quảng cáo.',
        });

        const res = await app.inject({
          method: 'GET',
          url: '/api/admin/reviews?state=rejected',
          headers: { cookie: admin.cookie },
        });
        const [item] = res.json().items as {
          moderationState: string;
          moderationNote: string | null;
        }[];
        expect(item?.moderationState).toBe('rejected');
        expect(item?.moderationNote).toBe('Nội dung quảng cáo.');
      });

      it('review CURATED bị bác KHÔNG sinh email — không có tài khoản nào sau lưng', async () => {
        const admin = await signUpAdmin(app, ADMIN_EMAIL);
        const review = await seedPending('curated-mail');

        await reviewsService.moderate(admin.user.id, { id: review.id, verdict: 'reject' });

        expect(await prisma.outbox.count({ where: { type: EmailType.REVIEW_REJECTED } })).toBe(0);
      });
    });

    it('adminList: lọc theo TRẠNG THÁI hoạt động đúng (ADR-0031)', async () => {
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
          body: 'Review đã duyệt, phải nằm trong kết quả state=approved',
          authorName: 'Alice',
          isApproved: true,
        },
      });
      const pending = await prisma.review.create({
        data: {
          tourId: tour.id,
          source: ReviewSource.CURATED,
          rating: 2,
          body: 'Review đang chờ duyệt, phải nằm trong kết quả state=pending',
          authorName: 'Bob',
          isApproved: false,
        },
      });

      const approvedOnly = await app.inject({
        method: 'GET',
        url: '/api/admin/reviews?state=approved',
        headers: { cookie: admin.cookie },
      });
      expect(approvedOnly.statusCode).toBe(200);
      const approvedItems = approvedOnly.json().items;
      expect(approvedItems).toHaveLength(1);
      expect(approvedItems[0].id).toBe(approved.id);

      const pendingOnly = await app.inject({
        method: 'GET',
        url: '/api/admin/reviews?state=pending',
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
        payload: { id: twoStar.id, verdict: 'approve' },
      });
      const moderated = (await get('?state=approved'))
        .json()
        .items.find((r: { id: string }) => r.id === twoStar.id);
      expect(moderated.moderatedBy).toBe(adminRow.name);
    });

    it('adminList: lọc theo khoảng ngày GỬI, trọn ngày `to`, review chưa duyệt KHÔNG bị loại', async () => {
      // ADR-0028 §AMEND 2: cột lọc là `created_at`. Điểm phải canh là biên
      // NỬA-MỞ — một review gửi lúc 23:59 ngày `to` vẫn phải nằm trong khoảng,
      // và một review CHƯA duyệt (`moderated_at` null) không được rơi ra
      // ngoài, vì đó chính là hàng đợi mà trang tồn tại để dọn.
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const category = await prisma.tourCategory.create({
        data: { slug: 'range-cat', name: 'Range', order: 1 },
      });
      const tour = await prisma.tour.create({
        data: {
          slug: 'range-tour',
          title: 'Range Tour',
          categoryId: category.id,
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: true,
        },
      });
      const at = async (iso: string, body: string) =>
        prisma.review.create({
          data: {
            tourId: tour.id,
            source: ReviewSource.CURATED,
            rating: 4,
            body,
            authorName: 'Range Author',
            isApproved: false,
            createdAt: new Date(iso),
          },
        });
      const before = await at('2026-04-30T23:59:59.000Z', 'Truoc khoang mot giay');
      const first = await at('2026-05-01T00:00:00.000Z', 'Dau khoang dung nua dem');
      const lastMinute = await at('2026-05-31T23:59:00.000Z', 'Cuoi khoang sat nua dem');
      const after = await at('2026-06-01T00:00:00.000Z', 'Sau khoang mot giay');

      const ids = async (qs: string) => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/admin/reviews${qs}`,
          headers: { cookie: admin.cookie },
        });
        return (res.json().items as { id: string }[]).map((r) => r.id);
      };

      const inRange = await ids('?from=2026-05-01&to=2026-05-31');
      expect(inRange).toContain(first.id);
      expect(inRange).toContain(lastMinute.id);
      expect(inRange).not.toContain(before.id);
      expect(inRange).not.toContain(after.id);
      // Chưa duyệt vẫn nằm trong kết quả — cùng bộ lọc, cộng dồn với trạng thái.
      expect(await ids('?from=2026-05-01&to=2026-05-31&state=pending')).toEqual(
        expect.arrayContaining([first.id, lastMinute.id]),
      );
      // Một đầu: `from` không có `to` là "từ ngày ấy trở đi".
      const openEnded = await ids('?from=2026-05-01');
      expect(openEnded).toContain(after.id);
      expect(openEnded).not.toContain(before.id);
    });
  });

  /**
   * ADR-0032 — đường quay lại cho tác giả. Bốn cổng và một trần, và thứ đáng
   * canh nhất là **cổng `approved`**: nó là ranh giới chặn việc tráo một bài
   * đã duyệt thành spam sau lưng kiểm duyệt.
   */
  describe('reviews.update — tác giả viết lại (ADR-0032)', () => {
    /** Booking đã đi xong + một review chờ duyệt của chính chủ. */
    async function seedOwnReview(email: string) {
      const { user, cookie } = await signUpAndSignIn(app, email);
      await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: user.id });
      const created = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: { cookie },
        payload: { bookingCode: 'BK-TESTREV1', rating: 4, body: 'Bài viết đầu tiên của khách' },
      });
      return { user, cookie, reviewId: created.json().id as string };
    }

    const patch = (cookie: string, id: string, payload: Record<string, unknown>) =>
      app.inject({ method: 'PATCH', url: `/api/reviews/${id}`, headers: { cookie }, payload });

    it('sửa review ĐANG CHỜ: nội dung thay, vẫn ở hàng đợi', async () => {
      const { cookie, reviewId } = await seedOwnReview('edit-pending@example.com');

      const res = await patch(cookie, reviewId, {
        id: reviewId,
        rating: 5,
        body: 'Bài viết đã sửa lại cho rõ ràng hơn',
      });

      expect(res.statusCode).toBe(200);
      const after = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
      expect(after.rating).toBe(5);
      expect(after.body).toBe('Bài viết đã sửa lại cho rõ ràng hơn');
      expect(after.isApproved).toBe(false);
      expect(after.rejectedAt).toBeNull();
    });

    it('sửa review ĐÃ BỊ BÁC: quay lại hàng đợi, nhưng dấu vết quyết định GIỮ', async () => {
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const { cookie, reviewId } = await seedOwnReview('edit-rejected@example.com');
      await reviewsService.moderate(admin.user.id, {
        id: reviewId,
        verdict: 'reject',
        note: 'Chưa nói về chuyến đi.',
      });

      await patch(cookie, reviewId, { id: reviewId, rating: 4, body: 'Lần này viết về chuyến đi' });

      const after = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
      expect(after.rejectedAt).toBeNull();
      expect(after.rejectedById).toBeNull();
      // `moderatedAt` GIỮ: lần quyết định ấy ĐÃ xảy ra (ADR-0032 §4).
      expect(after.moderatedAt).not.toBeNull();
      // KHÔNG ghi sự kiện moderation — sổ ấy ghi hành vi người DUYỆT.
      expect(await prisma.reviewModerationEvent.count({ where: { reviewId } })).toBe(1);
    });

    it('review của NGƯỜI KHÁC → 404, không phải 403', async () => {
      // Id review của người khác thì họ chưa từng thấy; xác nhận nó tồn tại
      // đã là rò rỉ.
      const { reviewId } = await seedOwnReview('owner@example.com');
      const intruder = await signUpAndSignIn(app, 'intruder@example.com');

      const res = await patch(intruder.cookie, reviewId, {
        id: reviewId,
        rating: 1,
        body: 'Tôi không phải chủ review này',
      });

      expect(res.statusCode).toBe(404);
    });

    it('review ĐÃ DUYỆT KHÔNG sửa được — chặn đường tráo nội dung đang hiển thị', async () => {
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const { cookie, reviewId } = await seedOwnReview('edit-approved@example.com');
      await reviewsService.moderate(admin.user.id, { id: reviewId, verdict: 'approve' });

      const res = await patch(cookie, reviewId, {
        id: reviewId,
        rating: 1,
        body: 'Nội dung tráo vào sau khi đã được duyệt',
      });

      expect(res.statusCode).toBe(409);
      const after = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
      expect(after.body).toBe('Bài viết đầu tiên của khách');
    });

    it('bác đủ HAI lần thì đường sửa ĐÓNG', async () => {
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const { cookie, reviewId } = await seedOwnReview('edit-limit@example.com');

      await reviewsService.moderate(admin.user.id, { id: reviewId, verdict: 'reject' });
      expect(
        (await patch(cookie, reviewId, { id: reviewId, rating: 4, body: 'Viết lại lần một' }))
          .statusCode,
      ).toBe(200);

      await reviewsService.moderate(admin.user.id, { id: reviewId, verdict: 'reject' });
      const res = await patch(cookie, reviewId, {
        id: reviewId,
        rating: 4,
        body: 'Viết lại lần hai',
      });

      expect(res.statusCode).toBe(409);
      const after = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
      expect(after.body).toBe('Viết lại lần một');
    });

    it('ảnh KHÔNG thuộc folder của booking → 400', async () => {
      const { cookie, reviewId } = await seedOwnReview('edit-photo@example.com');

      const res = await patch(cookie, reviewId, {
        id: reviewId,
        rating: 4,
        body: 'Có kèm một tấm ảnh lạ',
        photos: ['reviews/BK-SOMEONEELSE/one'],
      });

      expect(res.statusCode).toBe(400);
    });

    it('`photos` VẮNG nghĩa là gỡ hết ảnh — thay TRỌN, không cộng thêm', async () => {
      // Bác vì một tấm ảnh mà tác giả không gỡ được thì đường quay lại là đồ
      // giả (ADR-0032 §3).
      const { cookie, reviewId } = await seedOwnReview('edit-clear@example.com');
      await prisma.mediaAsset.create({
        data: {
          publicId: 'reviews/BK-TESTREV1/old',
          type: MediaType.IMAGE,
          ownerType: MediaOwnerType.REVIEW,
          ownerId: reviewId,
          role: MediaRole.gallery,
          sortOrder: 0,
        },
      });

      await patch(cookie, reviewId, { id: reviewId, rating: 4, body: 'Bỏ hết ảnh đi' });

      expect(
        await prisma.mediaAsset.count({
          where: { ownerType: MediaOwnerType.REVIEW, ownerId: reviewId },
        }),
      ).toBe(0);
    });

    it('`bookings.byCode` trả kèm review với trạng thái + lý do bác', async () => {
      // Trước ADR-0032 trang chi tiết chỉ có `reviewedAt` — một mốc thời gian
      // không mang phán quyết, nên khách bị bác đọc thấy "bạn đã đánh giá rồi".
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const { cookie, reviewId } = await seedOwnReview('bycode@example.com');
      await reviewsService.moderate(admin.user.id, {
        id: reviewId,
        verdict: 'reject',
        note: 'Ảnh có mặt người khác.',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/bookings/BK-TESTREV1',
        headers: { cookie },
      });
      const review = res.json().review as {
        moderationState: string;
        moderationNote: string | null;
        rejectionCount: number;
      };

      expect(review.moderationState).toBe('rejected');
      expect(review.moderationNote).toBe('Ảnh có mặt người khác.');
      expect(review.rejectionCount).toBe(1);
    });
  });

  describe('moderate: bust cache web SAU commit (Task 3, ADR-0016 §3)', () => {
    // Spy thay real fetch — service thật ($REVALIDATE_SECRET/$FRONTEND_URL
    // default dev vẫn hoạt động vì fire-and-forget nuốt lỗi network, nhưng
    // spy cho biết ĐÚNG khi nào/với tag gì service được gọi, không phụ thuộc
    // web app có chạy hay không.
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      spy = vi.spyOn(webRevalidationService, 'revalidate').mockResolvedValue(undefined);
    });

    afterEach(() => {
      spy.mockRestore();
    });

    it('duyệt review PENDING gắn tour → bust ĐÚNG 1 lần với tag đúng slug', async () => {
      const { user, cookie } = await signUpAndSignIn(app, 'bust-approve@example.com');
      const { tour } = await seedCompletedBooking({
        endDate: new Date(Date.now() - 864e5),
        userId: user.id,
      });
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const created = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: { cookie },
        payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Đáng để quay lại lần nữa' },
      });
      const reviewId = created.json().id;

      await reviewsService.moderate(admin.user.id, { id: reviewId, verdict: 'approve' });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(['tours', `tour:${tour.slug}`]);
    });

    it('duyệt lại review ĐANG đã approved (trạng thái KHÔNG đổi) → KHÔNG bust thêm', async () => {
      const { user, cookie } = await signUpAndSignIn(app, 'bust-same@example.com');
      await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: user.id });
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const created = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: { cookie },
        payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Rất hài lòng với chuyến đi' },
      });
      const reviewId = created.json().id;

      // Lần 1: PENDING → approved, có bust.
      await reviewsService.moderate(admin.user.id, { id: reviewId, verdict: 'approve' });
      expect(spy).toHaveBeenCalledTimes(1);

      // Lần 2: approve lại khi ĐÃ approved — fromApproved === toApproved, không bust thêm.
      await reviewsService.moderate(admin.user.id, { id: reviewId, verdict: 'approve' });
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('un-approve review đang approved → bust lại đúng tag', async () => {
      const { user, cookie } = await signUpAndSignIn(app, 'bust-unapprove@example.com');
      const { tour } = await seedCompletedBooking({
        endDate: new Date(Date.now() - 864e5),
        userId: user.id,
      });
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const created = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: { cookie },
        payload: { bookingCode: 'BK-TESTREV1', rating: 3, body: 'Bình thường, tạm được thôi' },
      });
      const reviewId = created.json().id;
      await reviewsService.moderate(admin.user.id, { id: reviewId, verdict: 'approve' });
      expect(spy).toHaveBeenCalledTimes(1);

      await reviewsService.moderate(admin.user.id, { id: reviewId, verdict: 'unpublish' });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith(['tours', `tour:${tour.slug}`]);
    });

    it('duyệt review CURATED KHÔNG gắn tour (tourId null) → không bust', async () => {
      const admin = await signUpAdmin(app, ADMIN_EMAIL);
      const curated = await prisma.review.create({
        data: {
          tourId: null,
          source: ReviewSource.CURATED,
          authorName: 'Marketing Team',
          rating: 5,
          body: 'Testimonial chung, không gắn vào tour cụ thể nào',
          isApproved: false,
        },
      });

      await reviewsService.moderate(admin.user.id, { id: curated.id, verdict: 'approve' });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('reviews.byTour — sort/filter/breakdown (Task 1)', () => {
    let tourSlug: string;

    beforeEach(async () => {
      const { tour } = await seedReviewsAcrossRatings();
      tourSlug = tour.slug;
    });

    it('sort=highest xếp sao cao trước, tài khoản đã xoá VẪN nằm cuối', async () => {
      const res = await client.reviews.byTour({ tourSlug, sort: 'highest', pageSize: 50 });
      const ratings = res.items.filter((r) => !r.authorDeleted).map((r) => r.rating);
      expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
      const deletedIdx = res.items.findIndex((r) => r.authorDeleted);
      if (deletedIdx !== -1) expect(deletedIdx).toBe(res.items.length - 1);
    });

    it('rating=5 chỉ trả review 5 sao', async () => {
      const res = await client.reviews.byTour({ tourSlug, rating: 5, pageSize: 50 });
      expect(res.items.every((r) => r.rating === 5)).toBe(true);
    });

    it('withPhotos=true chỉ trả review có ảnh', async () => {
      const res = await client.reviews.byTour({ tourSlug, withPhotos: true, pageSize: 50 });
      expect(res.items.every((r) => r.media.length > 0)).toBe(true);
    });

    it('breakdown tính trên tập CHƯA lọc theo sao', async () => {
      const all = await client.reviews.byTour({ tourSlug, pageSize: 50 });
      const filtered = await client.reviews.byTour({ tourSlug, rating: 5, pageSize: 50 });
      expect(filtered.breakdown).toEqual(all.breakdown);
      const sum = Object.values(all.breakdown).reduce((a, b) => a + b, 0);
      expect(sum).toBe(all.total);
    });
  });
});
