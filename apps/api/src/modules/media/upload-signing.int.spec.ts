import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { v2 as cloudinary } from 'cloudinary';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { createFastifyAdapter } from '../../bootstrap.js';
import { BookingStatus } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Chốt endpoint media.signUpload (ADR-0021 Task 4): 401 chưa đăng nhập, ký
 * AVATAR đúng folder/chữ ký, và REVIEW_PHOTO soi CÙNG luật eligibility với
 * reviews.create (403/400/404 tương ứng).
 *
 * Dùng `createFastifyAdapter()` (trustProxy, dùng chung main.ts) chứ không
 * `new FastifyAdapter()` trần như reviews.int.spec.ts — controller này CÓ
 * `ThrottlerGuard` (khuôn newsletter/enquiries.int.spec.ts), thiếu trustProxy
 * thì test throttle theo IP sai (mọi `.inject()` trông như cùng một IP giả).
 */

const PASSWORD = 'password-123';

let app: NestFastifyApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Thứ tự truncate theo chiều phụ thuộc FK (khuôn reviews.int.spec.ts, rút
  // gọn — media không có bảng riêng cần truncate thêm).
  await prisma.$executeRawUnsafe(
    'TRUNCATE reviews, bookings, tour_departures, tours, tour_categories, destinations, users, sessions, accounts RESTART IDENTITY CASCADE',
  );
});

/** Lấy cookie pair (name=value) từ set-cookie của inject response. */
// Nguồn: reviews.int.spec.ts sessionCookie() — hàm file-local không export.
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
 * Đăng ký + đăng nhập một customer thường, trả về cookie session + userId.
 * Nguồn: reviews.int.spec.ts signUpAndSignIn() — hàm file-local không export,
 * chép lại kèm bước lấy userId qua prisma.user.findUniqueOrThrow() (brief §Step 2).
 */
async function signUpAndSignIn(email: string) {
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
  return { cookie, userId: user.id };
}

/**
 * Dựng 1 tour + 1 departure + 1 booking PAID của user cho sẵn, mã cố định
 * BK-TESTREV1. Nguồn: reviews.int.spec.ts seedCompletedBooking() — hàm
 * file-local không export, chép lại nguyên khuôn.
 */
async function seedCompletedBooking(opts: {
  endDate: Date;
  userId: string;
  status?: BookingStatus;
}) {
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
      status: opts.status ?? BookingStatus.PAID,
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

/**
 * POST /api/media/upload-signatures với một IP RIÊNG cho mỗi test (khuôn
 * newsletter/enquiries.int.spec.ts) — `MediaController` có `ThrottlerGuard`
 * (PUBLIC_WRITE_THROTTLE: 5 request/60s/IP); dùng chung một IP cho cả 8 case
 * trong file này sẽ ăn 429 giả ở những case gọi sau case thứ năm.
 */
function signUploadReq(fakeIp: string, payload: Record<string, unknown>, cookie?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/media/upload-signatures',
    headers: { 'x-forwarded-for': fakeIp, ...(cookie ? { cookie } : {}) },
    payload,
  });
}

describe('media.signUpload', () => {
  it('chưa đăng nhập → 401', async () => {
    const res = await signUploadReq('10.2.0.1', { purpose: 'AVATAR', ext: 'png' });
    expect(res.statusCode).toBe(401);
  });

  it('AVATAR: trả đủ bộ tham số, folder khoá theo userId, chữ ký verify được bằng SDK', async () => {
    const { cookie, userId } = await signUpAndSignIn('avatar@example.com');
    const res = await signUploadReq('10.2.0.2', { purpose: 'AVATAR', ext: 'png' }, cookie);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.folder).toBe(`tourism/avatars/${userId}`);
    expect(body.cloudName).toBeTruthy();
    expect(body.uploadUrl).toContain('/image/upload');
    expect(body.signature).toBe(
      cloudinary.utils.api_sign_request(
        { folder: body.folder, public_id: body.publicId, timestamp: body.timestamp },
        'int-test-secret',
      ),
    );
  });

  it('REVIEW_PHOTO: booking đủ điều kiện → folder reviews/<code>', async () => {
    const { cookie, userId } = await signUpAndSignIn('review-ok@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId });

    const res = await signUploadReq(
      '10.2.0.3',
      { purpose: 'REVIEW_PHOTO', ext: 'jpg', bookingCode: 'BK-TESTREV1' },
      cookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.folder).toBe('tourism/reviews/BK-TESTREV1');
  });

  it('REVIEW_PHOTO: booking của người khác → 403 BOOKING_FORBIDDEN', async () => {
    const owner = await signUpAndSignIn('owner@example.com');
    const other = await signUpAndSignIn('other@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: owner.userId });

    const res = await signUploadReq(
      '10.2.0.4',
      { purpose: 'REVIEW_PHOTO', ext: 'jpg', bookingCode: 'BK-TESTREV1' },
      other.cookie,
    );

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('BOOKING_FORBIDDEN');
  });

  it('REVIEW_PHOTO: booking chưa PAID → 400 REVIEW_NOT_ELIGIBLE', async () => {
    const { cookie, userId } = await signUpAndSignIn('pending@example.com');
    await seedCompletedBooking({
      endDate: new Date(Date.now() - 864e5),
      userId,
      status: BookingStatus.PENDING,
    });

    const res = await signUploadReq(
      '10.2.0.5',
      { purpose: 'REVIEW_PHOTO', ext: 'jpg', bookingCode: 'BK-TESTREV1' },
      cookie,
    );

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('REVIEW_NOT_ELIGIBLE');
  });

  it('REVIEW_PHOTO: chuyến chưa kết thúc → 400 REVIEW_TRIP_NOT_COMPLETED', async () => {
    const { cookie, userId } = await signUpAndSignIn('future@example.com');
    const future = new Date(Date.now() + 30 * 864e5);
    await seedCompletedBooking({ endDate: future, userId });

    const res = await signUploadReq(
      '10.2.0.6',
      { purpose: 'REVIEW_PHOTO', ext: 'jpg', bookingCode: 'BK-TESTREV1' },
      cookie,
    );

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('REVIEW_TRIP_NOT_COMPLETED');
  });

  it('REVIEW_PHOTO: mã không tồn tại → 404 BOOKING_NOT_FOUND', async () => {
    const { cookie } = await signUpAndSignIn('nobooking@example.com');

    const res = await signUploadReq(
      '10.2.0.7',
      { purpose: 'REVIEW_PHOTO', ext: 'jpg', bookingCode: 'BK-KHONGCO1' },
      cookie,
    );

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('BOOKING_NOT_FOUND');
  });

  it('6 lần ký AVATAR liên tiếp CÙNG IP → cả 6 đều 200 (headroom SIGN_UPLOAD_THROTTLE, không dính trần public 5/60s)', async () => {
    // signUpload là endpoint ĐÃ AUTH, không nên dùng chung trần PUBLIC_WRITE_
    // THROTTLE (5/60s) — đúng khít mức dùng hợp lệ của MỘT review 5 ảnh, nên
    // lần ký thứ 6 (đổi ảnh, retry, 2 khách chung NAT) ăn 429 oan.
    const { cookie } = await signUpAndSignIn('sixsigns@example.com');
    const fakeIp = '10.2.0.9';

    for (let i = 0; i < 6; i++) {
      const res = await signUploadReq(fakeIp, { purpose: 'AVATAR', ext: 'png' }, cookie);
      expect(res.statusCode).toBe(200);
    }
  });

  it('đuôi file lạ → 400 từ tầng validate contract', async () => {
    const { cookie } = await signUpAndSignIn('badext@example.com');

    const res = await signUploadReq('10.2.0.8', { purpose: 'AVATAR', ext: 'exe' }, cookie);

    expect(res.statusCode).toBe(400);
  });
});
