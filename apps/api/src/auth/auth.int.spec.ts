import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { UserRole } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * ADMIN_EMAILS=bootstrap-admin@tourism.test được set trong config env.
 */

const PASSWORD = 'password-123';

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

async function signUp(app: NestFastifyApplication, email: string, name = 'Test User') {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: PASSWORD, name },
  });
}

describe('auth integration (Better Auth + tombstone)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    // Thứ tự truncate theo chiều phụ thuộc FK (bookings/tours thêm vào cho
    // fixture VERIFIED của test d — xem comment ở đó).
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE reviews, bookings, tour_departures, tours, tour_categories, users, sessions, accounts, verifications CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('a. sign-up/email creates a CUSTOMER user row', async () => {
    const res = await signUp(app, 'alice@example.com', 'Alice');
    expect(res.statusCode).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe(UserRole.CUSTOMER);
    expect(user?.name).toBe('Alice');
    expect(user?.deletedAt).toBeNull();
  });

  it('b. sign-up with bootstrap admin email gets role=ADMIN via create.after hook', async () => {
    // Case khác với ADMIN_EMAILS để chứng minh match case-insensitive.
    const res = await signUp(app, 'Bootstrap-Admin@tourism.test', 'Boss');
    expect(res.statusCode).toBe(200);

    const user = await prisma.user.findUnique({
      where: { email: 'bootstrap-admin@tourism.test' },
    });
    expect(user).not.toBeNull();
    expect(user?.role).toBe(UserRole.ADMIN);
  });

  it('c. sign-in/email returns a session cookie that passes the AuthGuard probe', async () => {
    await signUp(app, 'carol@example.com', 'Carol');

    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: 'carol@example.com', password: PASSWORD },
    });
    expect(signIn.statusCode).toBe(200);
    const cookie = sessionCookie(signIn);

    const me = await app.inject({
      method: 'GET',
      url: '/api/account/me',
      headers: { cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: 'carol@example.com', role: UserRole.CUSTOMER });

    // Không cookie → 401.
    const anon = await app.inject({ method: 'GET', url: '/api/account/me' });
    expect(anon.statusCode).toBe(401);
  });

  it('d. DELETE /api/account tombstones the user and frees the email', async () => {
    const email = 'dave@example.com';
    const signUpRes = await signUp(app, email, 'Dave');
    expect(signUpRes.statusCode).toBe(200);
    const cookie = sessionCookie(signUpRes); // autoSignIn mặc định của BA

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('sign-up did not create user');

    // Review VERIFIED của user — CHECK `reviews_source_shape` (migration
    // p3a_customer, sau khi test này viết) đòi VERIFIED phải có ĐỦ CẢ BA
    // tourId/userId/bookingId NOT NULL, nên phải dựng tour+booking tối
    // thiểu kèm theo (không còn "tourId/bookingId nullable" như trước nữa).
    const category = await prisma.tourCategory.create({
      data: { slug: 'walking-d', name: 'Walking', order: 1 },
    });
    const tour = await prisma.tour.create({
      data: {
        slug: 'dave-tombstone-tour',
        title: 'Dave Tombstone Tour',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: true,
      },
    });
    const departure = await prisma.tourDeparture.create({
      data: {
        tourId: tour.id,
        startDate: new Date(Date.now() - 864e5),
        endDate: new Date(Date.now() - 864e5),
        seatsTotal: 10,
        seatsBooked: 1,
      },
    });
    const booking = await prisma.booking.create({
      data: {
        code: 'BK-DAVETEST',
        userId: user.id,
        tourId: tour.id,
        departureId: departure.id,
        numAdults: 1,
        totalAmount: '39.00',
        currency: 'USD',
        status: 'PAID',
        tourTitle: tour.title,
        departureStartDate: departure.startDate,
        departureEndDate: departure.endDate,
        unitPrice: '39.00',
        contactName: 'Dave',
        contactEmail: email,
        paymentProvider: 'STRIPE',
      },
    });
    const review = await prisma.review.create({
      data: {
        tourId: tour.id,
        userId: user.id,
        bookingId: booking.id,
        rating: 5,
        body: 'Great trip!',
        authorName: 'Dave',
      },
    });

    const del = await app.inject({ method: 'DELETE', url: '/api/account', headers: { cookie } });
    expect(del.statusCode).toBe(204);

    // User row: tombstoned + scrubbed, KHÔNG bị hard-delete.
    const tombstoned = await prisma.user.findUnique({ where: { id: user.id } });
    expect(tombstoned).not.toBeNull();
    expect(tombstoned?.deletedAt).not.toBeNull();
    expect(tombstoned?.email.startsWith('deleted+')).toBe(true);
    expect(tombstoned?.email.endsWith('@tombstone.local')).toBe(true);
    expect(tombstoned?.name).toBeNull();
    expect(tombstoned?.phone).toBeNull();
    expect(tombstoned?.image).toBeNull();

    // Sessions + accounts hard-deleted.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);

    // Review flag denormalized bật — VÀ authorName phải được scrub trong
    // CÙNG transaction (spec §4.2). Bật cờ mà quên scrub thì tên vẫn nằm
    // trong DB — API hiện che được nhờ ternary trong mapper (toPublicReview),
    // nhưng đây là lỗ xoá-dữ-liệu (GDPR erasure) thật ở tầng dữ liệu, chỉ cần
    // một mapper tương lai quên ternary là thành lỗ API thật. `authorName`
    // là NOT NULL (schema) nên scrub về chuỗi rỗng, không phải null.
    const flagged = await prisma.review.findUnique({ where: { id: review.id } });
    expect(flagged?.authorDeleted).toBe(true);
    expect(flagged?.authorName).toBe('');

    // Session cũ chết → 401.
    const stale = await app.inject({ method: 'GET', url: '/api/account/me', headers: { cookie } });
    expect(stale.statusCode).toBe(401);

    // Email gốc được giải phóng → đăng ký lại thành công.
    const reSignUp = await signUp(app, email, 'Dave II');
    expect(reSignUp.statusCode).toBe(200);
    const fresh = await prisma.user.findUnique({ where: { email } });
    expect(fresh).not.toBeNull();
    expect(fresh?.id).not.toBe(user.id);
  });
});
