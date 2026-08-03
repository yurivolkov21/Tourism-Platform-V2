import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { EmailType, UserRole } from '../generated/prisma/enums.js';
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
      'TRUNCATE TABLE reviews, bookings, tour_departures, tours, tour_categories, users, sessions, accounts, verifications, subscribers, outbox CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // CẬP NHẬT ADR-0017 §5a: sendOnSignUp giờ gửi OTP (EmailType.EMAIL_OTP) thay
  // vì link (EMAIL_VERIFICATION) — plugin emailOTP override sendVerificationEmail.
  // Test gốc assert link cũ; hành vi đổi là ĐÚNG thiết kế (xem auth.config.ts),
  // sửa assertion theo OTP thay vì xoá (brief Task 1 Step 5).
  it('e. signup gửi verify OTP qua outbox (ADR-0017 §5a — override link cũ)', async () => {
    await signUp(app, 'verify-me@example.com', 'V');
    const rows = await prisma.outbox.findMany({ where: { type: EmailType.EMAIL_OTP } });
    expect(rows).toHaveLength(1);
    const payload = rows[0]?.payload as { email?: string; otp?: string };
    expect(payload.email).toBe('verify-me@example.com');
    expect(payload.otp).toMatch(/^\d{6}$/);
  });

  it('f. request-password-reset ghi outbox PASSWORD_RESET, không console.log (AUTH-2)', async () => {
    const email = 'reset-me@example.com';
    await signUp(app, email, 'R');
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, redirectTo: '/reset' }),
    });
    expect(res.statusCode).toBe(200);
    const rows = await prisma.outbox.findMany({ where: { type: EmailType.PASSWORD_RESET } });
    expect(rows).toHaveLength(1);
    const payload = rows[0]?.payload as { email?: string };
    expect(payload.email).toBe(email);
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

  it('b. signup email admin CHƯA verify KHÔNG được promote (SEC-1)', async () => {
    // Case khác ADMIN_EMAILS (match citext) — nhưng CHƯA verify nên chưa chứng
    // minh sở hữu email → giữ CUSTOMER. Kẻ đăng ký email admin mà không kiểm
    // soát inbox không bao giờ verify được → không bao giờ thành admin.
    const res = await signUp(app, 'Bootstrap-Admin@tourism.test', 'Boss');
    expect(res.statusCode).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'bootstrap-admin@tourism.test' },
    });
    expect(user.role).toBe(UserRole.CUSTOMER);
    expect(user.emailVerified).toBe(false);
  });

  /**
   * Verify email user vừa signup: lấy OTP từ outbox (sendOnSignUp) → POST verify.
   * CẬP NHẬT ADR-0017 §5a — trước đây đọc `url` + GET `/verify-email?token=`
   * (flow link); giờ đọc `otp` + POST `/email-otp/verify-email` (flow OTP mới,
   * xem auth.config.ts). Vẫn dùng chung tên hàm vì b2/b3 dựa vào side-effect
   * giống nhau: verify xong → afterEmailVerification quyết định role.
   */
  async function verifyLatestEmail(): Promise<void> {
    const vrow = await prisma.outbox.findFirstOrThrow({
      where: { type: EmailType.EMAIL_OTP },
      orderBy: { createdAt: 'desc' },
    });
    const { email, otp } = vrow.payload as { email: string; otp: string };
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/verify-email',
      headers: { 'content-type': 'application/json' },
      payload: { email, otp },
    });
    expect(res.statusCode).toBe(200);
  }

  it('b2. signup email admin → verify → promote ADMIN (SEC-1 happy path)', async () => {
    await signUp(app, 'bootstrap-admin@tourism.test', 'Boss');
    await verifyLatestEmail();
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'bootstrap-admin@tourism.test' },
    });
    expect(user.emailVerified).toBe(true);
    expect(user.role).toBe(UserRole.ADMIN); // afterEmailVerification promote
  });

  it('b3. verify email user THƯỜNG KHÔNG promote (guard afterEmailVerification)', async () => {
    await signUp(app, 'not-admin@example.com', 'Reg');
    await verifyLatestEmail();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'not-admin@example.com' } });
    expect(user.emailVerified).toBe(true);
    expect(user.role).toBe(UserRole.CUSTOMER);
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

    // Subscriber trùng email (NL-R1): account deletion phải dọn HẲN để không còn
    // gửi marketing tới email của user "đã xoá" (GDPR erasure).
    await prisma.subscriber.create({ data: { email, source: 'test' } });

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

    // Subscriber trùng email bị xoá HẲN (NL-R1 — GDPR erasure trên account deletion).
    expect(await prisma.subscriber.count({ where: { email } })).toBe(0);

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

/**
 * ADR-0017 §5a: flow verify email đổi từ link sang OTP (plugin `emailOTP`).
 * Điều kiện nghiệm thu bắt buộc — hook `afterEmailVerification` (promote
 * admin, SEC-1/ADR-0008) PHẢI fire cả ở đường OTP, không chỉ đường link cũ.
 * describe RIÊNG (app instance riêng) — tách khỏi describe trên để không
 * đụng fixture/luồng của các test link-verify hiện có.
 */
describe('verify email bằng OTP (ADR-0017 §5a — SEC-1 phải sống)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE reviews, bookings, tour_departures, tours, tour_categories, users, sessions, accounts, verifications, subscribers, outbox CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  /** Đọc OTP mới nhất trong outbox (type EMAIL_OTP) — throw nếu chưa có row nào. */
  async function latestOtp(email: string): Promise<string> {
    const row = await prisma.outbox.findFirstOrThrow({
      where: { type: EmailType.EMAIL_OTP },
      orderBy: { createdAt: 'desc' },
    });
    const payload = row.payload as { email?: string; otp?: string };
    if (payload.email !== email) {
      throw new Error(`outbox EMAIL_OTP row mismatch email: ${payload.email}`);
    }
    if (!payload.otp) throw new Error('outbox EMAIL_OTP row missing otp');
    return payload.otp;
  }

  async function verifyOtp(email: string, otp: string) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/verify-email',
      headers: { 'content-type': 'application/json' },
      payload: { email, otp },
    });
  }

  it('1. sign-up ADMIN_EMAILS → verify OTP đúng → email_verified=true VÀ role=ADMIN (SEC-1)', async () => {
    const email = 'bootstrap-admin@tourism.test';
    await signUp(app, email, 'Boss');
    const otp = await latestOtp(email);

    const res = await verifyOtp(email, otp);
    expect(res.statusCode).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(true);
    expect(user.role).toBe(UserRole.ADMIN); // afterEmailVerification promote — phải fire cả đường OTP
  });

  it('2. sign-up email thường → verify OTP → role=CUSTOMER (không promote)', async () => {
    const email = 'not-admin-otp@example.com';
    await signUp(app, email, 'Reg');
    const otp = await latestOtp(email);

    const res = await verifyOtp(email, otp);
    expect(res.statusCode).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(true);
    expect(user.role).toBe(UserRole.CUSTOMER);
  });

  it('3. sau sign-up outbox CÓ row EMAIL_OTP và KHÔNG có row EMAIL_VERIFICATION mới (override link)', async () => {
    const email = 'otp-override@example.com';
    await signUp(app, email, 'O');

    const otpRows = await prisma.outbox.findMany({ where: { type: EmailType.EMAIL_OTP } });
    expect(otpRows).toHaveLength(1);
    const linkRows = await prisma.outbox.findMany({
      where: { type: EmailType.EMAIL_VERIFICATION },
    });
    expect(linkRows).toHaveLength(0);
  });

  it('4. OTP sai 1 ký tự → verify fail, email_verified vẫn false', async () => {
    const email = 'wrong-otp@example.com';
    await signUp(app, email, 'W');
    const otp = await latestOtp(email);
    // Đổi đúng 1 ký tự cuối — vẫn 6 số, chỉ sai giá trị.
    const lastDigit = otp.at(-1);
    const wrongLastDigit = lastDigit === '0' ? '1' : '0';
    const wrongOtp = `${otp.slice(0, -1)}${wrongLastDigit}`;

    const res = await verifyOtp(email, wrongOtp);
    expect(res.statusCode).not.toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(false);
  });
});
