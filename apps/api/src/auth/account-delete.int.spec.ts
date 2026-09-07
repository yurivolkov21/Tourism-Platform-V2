import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { EmailType } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/**
 * ADR-0017 §7b (W2): `DELETE /api/account` — tombstone là bất khả hoàn tác
 * nên phải (i) đòi MẬT KHẨU (bằng chứng sở hữu, không phải chỉ một cookie),
 * (ii) chặn khi còn tiền/nghĩa vụ treo (booking PAID chưa khởi hành, yêu cầu
 * huỷ đang mở) với mã lỗi RIÊNG, (iii) dọn `verification` treo trong CÙNG tx
 * (link reset cũ không được tạo lại Account cho user đã xoá).
 */

const PASSWORD = 'password-123';

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

describe('DELETE /api/account đòi xác thực lại + gate nghiệp vụ (ADR-0017 §7b)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE cancellation_requests, reviews, media_assets, media_garbage, bookings, tour_departures, tours, tour_categories, users, sessions, accounts, verifications, subscribers, outbox CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUserAndSignIn(email: string): Promise<{ cookie: string; userId: string }> {
    const su = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name: 'D' },
    });
    expect(su.statusCode).toBe(200);
    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
    const si = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: PASSWORD },
    });
    expect(si.statusCode).toBe(200);
    return { cookie: sessionCookie(si), userId: user.id };
  }

  /** Booking tối thiểu cho user — status + ngày khởi hành cấu hình được. */
  async function createBooking(
    userId: string,
    email: string,
    opts: {
      status: 'PAID' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'PENDING';
      departureInDays: number;
      /** Hạn session thanh toán (PENDING) — mặc định null. */
      checkoutSessionExpiresAt?: Date;
    },
  ) {
    const category = await prisma.tourCategory.create({
      data: { slug: `cat-${Math.random().toString(36).slice(2, 8)}`, name: 'C', order: 1 },
    });
    const tour = await prisma.tour.create({
      data: {
        slug: `tour-${Math.random().toString(36).slice(2, 8)}`,
        title: 'T',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: true,
      },
    });
    const start = new Date(Date.now() + opts.departureInDays * 864e5);
    const departure = await prisma.tourDeparture.create({
      data: { tourId: tour.id, startDate: start, endDate: start, seatsTotal: 10, seatsBooked: 1 },
    });
    return prisma.booking.create({
      data: {
        code: `BK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        userId,
        tourId: tour.id,
        departureId: departure.id,
        numAdults: 1,
        totalAmount: '39.00',
        currency: 'USD',
        status: opts.status,
        tourTitle: tour.title,
        departureStartDate: departure.startDate,
        departureEndDate: departure.endDate,
        unitPrice: '39.00',
        contactName: 'D',
        contactEmail: email,
        paymentProvider: 'STRIPE',
        ...(opts.checkoutSessionExpiresAt
          ? {
              providerSessionId: `cs_${Math.random().toString(36).slice(2, 10)}`,
              checkoutSessionUrl: 'https://checkout.fake.local/x',
              checkoutSessionExpiresAt: opts.checkoutSessionExpiresAt,
            }
          : {}),
      },
    });
  }

  // Không payload thì cũng KHÔNG content-type — Fastify từ chối
  // `application/json` với body rỗng từ TRƯỚC handler (FST_ERR_CTP_EMPTY…).
  async function deleteAccount(cookie: string, payload?: unknown) {
    return app.inject({
      method: 'DELETE',
      url: '/api/account',
      ...(payload === undefined
        ? { headers: { cookie } }
        : {
            headers: { cookie, 'content-type': 'application/json' },
            payload: JSON.stringify(payload),
          }),
    });
  }

  it('1. không gửi mật khẩu (không body, hoặc body thiếu field) → 400 PASSWORD_REQUIRED, user còn nguyên', async () => {
    const { cookie, userId } = await createUserAndSignIn('no-pass@example.com');
    const noBody = await deleteAccount(cookie);
    expect(noBody.statusCode).toBe(400);
    expect(noBody.json()).toMatchObject({ code: 'PASSWORD_REQUIRED' });
    const emptyObject = await deleteAccount(cookie, {});
    expect(emptyObject.statusCode).toBe(400);
    expect(emptyObject.json()).toMatchObject({ code: 'PASSWORD_REQUIRED' });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.deletedAt).toBeNull();
  });

  it('2. mật khẩu sai → 403 INVALID_PASSWORD, user còn nguyên', async () => {
    const { cookie, userId } = await createUserAndSignIn('wrong-pass@example.com');
    const res = await deleteAccount(cookie, { password: 'sai-be-bet-123' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'INVALID_PASSWORD' });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.deletedAt).toBeNull();
  });

  it('3. còn booking PAID CHƯA khởi hành → 409 ACCOUNT_HAS_PAID_BOOKINGS', async () => {
    const email = 'paid-upcoming@example.com';
    const { cookie, userId } = await createUserAndSignIn(email);
    await createBooking(userId, email, { status: 'PAID', departureInDays: 10 });
    const res = await deleteAccount(cookie, { password: PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'ACCOUNT_HAS_PAID_BOOKINGS' });
  });

  it('4. booking PAID chuyến ĐÃ KẾT THÚC (quá khứ) KHÔNG chặn → 204', async () => {
    const email = 'paid-past@example.com';
    const { cookie, userId } = await createUserAndSignIn(email);
    await createBooking(userId, email, { status: 'PAID', departureInDays: -30 });
    const res = await deleteAccount(cookie, { password: PASSWORD });
    expect(res.statusCode).toBe(204);
  });

  it('4b. PAID khởi hành HÔM NAY (chuyến đang chạy) và PARTIALLY_REFUNDED đã đi xong → đều 409 (ADR-0017 §7b, câu gốc)', async () => {
    // Biên ngày: endDate = hôm nay >= hôm nay → chưa kết thúc → chặn.
    const a = await createUserAndSignIn('paid-today@example.com');
    await createBooking(a.userId, 'paid-today@example.com', { status: 'PAID', departureInDays: 0 });
    expect((await deleteAccount(a.cookie, { password: PASSWORD })).statusCode).toBe(409);
    // Hoàn một phần, chuyến đã đi: sổ còn phần dư phải hoàn → vẫn chặn, bất kể ngày.
    const b = await createUserAndSignIn('partial-past@example.com');
    await createBooking(b.userId, 'partial-past@example.com', {
      status: 'PARTIALLY_REFUNDED',
      departureInDays: -30,
    });
    const res = await deleteAccount(b.cookie, { password: PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'ACCOUNT_HAS_PAID_BOOKINGS' });
  });

  it('4c. PENDING còn session thanh toán SỐNG → 409 ACCOUNT_HAS_PENDING_CHECKOUT; session đã hết → 204', async () => {
    const live = await createUserAndSignIn('pending-live@example.com');
    await createBooking(live.userId, 'pending-live@example.com', {
      status: 'PENDING',
      departureInDays: 20,
      checkoutSessionExpiresAt: new Date(Date.now() + 30 * 60_000),
    });
    const blocked = await deleteAccount(live.cookie, { password: PASSWORD });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ code: 'ACCOUNT_HAS_PENDING_CHECKOUT' });

    const dead = await createUserAndSignIn('pending-dead@example.com');
    await createBooking(dead.userId, 'pending-dead@example.com', {
      status: 'PENDING',
      departureInDays: 20,
      checkoutSessionExpiresAt: new Date(Date.now() - 1000),
    });
    expect((await deleteAccount(dead.cookie, { password: PASSWORD })).statusCode).toBe(204);
  });

  it('2b. sai mật khẩu 5 lần → lần 6 là 429 TOO_MANY_ATTEMPTS kể cả khi gõ ĐÚNG (chống dò bằng cookie trộm)', async () => {
    const { cookie, userId } = await createUserAndSignIn('lockout@example.com');
    for (let i = 0; i < 5; i++) {
      expect((await deleteAccount(cookie, { password: 'sai-be-bet-123' })).statusCode).toBe(403);
    }
    const locked = await deleteAccount(cookie, { password: PASSWORD });
    expect(locked.statusCode).toBe(429);
    expect(locked.json()).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.deletedAt).toBeNull();
  });

  it('2c. tài khoản KHÔNG có credential (chỉ OAuth) → 409 CREDENTIAL_ACCOUNT_NOT_FOUND', async () => {
    const { cookie, userId } = await createUserAndSignIn('oauth-only@example.com');
    await prisma.account.deleteMany({ where: { userId, providerId: 'credential' } });
    const res = await deleteAccount(cookie, { password: PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'CREDENTIAL_ACCOUNT_NOT_FOUND' });
  });

  it('6b. ảnh review của user đã xoá bị gỡ khỏi media_assets và vào hàng dọn (ADR-0017 §7b — erasure không dừng ở cái tên)', async () => {
    const email = 'review-photos@example.com';
    const { cookie, userId } = await createUserAndSignIn(email);
    const booking = await createBooking(userId, email, { status: 'PAID', departureInDays: -30 });
    const review = await prisma.review.create({
      data: {
        tourId: booking.tourId,
        userId,
        bookingId: booking.id,
        rating: 5,
        body: 'Great trip, photo attached',
        authorName: 'Photo Person',
        isApproved: true,
      },
    });
    await prisma.mediaAsset.create({
      data: {
        publicId: 'tourism/reviews/x/face',
        type: 'IMAGE',
        ownerType: 'REVIEW',
        ownerId: review.id,
        role: 'gallery',
      },
    });
    expect((await deleteAccount(cookie, { password: PASSWORD })).statusCode).toBe(204);
    expect(await prisma.mediaAsset.count({ where: { ownerId: review.id } })).toBe(0);
    const garbage = await prisma.mediaGarbage.findUnique({
      where: { publicId: 'tourism/reviews/x/face' },
    });
    expect(garbage).not.toBeNull();
    const after = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
    expect(after.authorDeleted).toBe(true);
    expect(after.authorName).toBe('');
  });

  it('5. còn cancellation request đang REQUESTED → 409 ACCOUNT_HAS_OPEN_CANCELLATION', async () => {
    const email = 'open-cxl@example.com';
    const { cookie, userId } = await createUserAndSignIn(email);
    // Booking CANCELLED (không dính gate PAID) nhưng request còn mở — đường
    // hoàn tiền đang chạy dở, xoá tài khoản là tự cắt liên lạc.
    const booking = await createBooking(userId, email, {
      status: 'CANCELLED',
      departureInDays: 20,
    });
    await prisma.cancellationRequest.create({
      data: { bookingId: booking.id, userId, reason: 'Change of plans' },
    });
    const res = await deleteAccount(cookie, { password: PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'ACCOUNT_HAS_OPEN_CANCELLATION' });
  });

  it('6. đúng mật khẩu → 204; verification treo (reset token + OTP) bị dọn trong cùng tx', async () => {
    const email = 'clean-verifications@example.com';
    const { cookie } = await createUserAndSignIn(email);
    // Gieo verification treo cả HAI dạng thật của Better Auth:
    // reset-password:<token> (value = userId) và <type>-otp-<email>.
    const req = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, redirectTo: '/reset-password' }),
    });
    expect(req.statusCode).toBe(200);
    const otpReq = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, type: 'email-verification' }),
    });
    expect(otpReq.statusCode).toBe(200);
    expect(await prisma.verification.count()).toBeGreaterThanOrEqual(2);

    const res = await deleteAccount(cookie, { password: PASSWORD });
    expect(res.statusCode).toBe(204);

    // Không còn row nào trỏ về user này — link reset cũ chết hẳn, không tạo
    // lại được Account cho user tombstone.
    expect(await prisma.verification.count()).toBe(0);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: { startsWith: 'deleted+' } },
    });
    expect(user.deletedAt).not.toBeNull();
  });

  it('7. token reset sống 30 phút — khớp copy web "expires in 30 minutes"', async () => {
    const email = 'reset-ttl@example.com';
    await createUserAndSignIn(email);
    await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, redirectTo: '/reset-password' }),
    });
    const row = await prisma.outbox.findFirstOrThrow({
      where: { type: EmailType.PASSWORD_RESET },
    });
    const { url } = row.payload as { url: string };
    const token = new URL(url).pathname.split('/').at(-1);
    const verification = await prisma.verification.findFirstOrThrow({
      where: { identifier: `reset-password:${token}` },
    });
    const ttlSeconds = (verification.expiresAt.getTime() - verification.createdAt.getTime()) / 1000;
    // 1800s ± 60s slack (createdAt do DB, expiresAt do BA tính trước đó).
    expect(ttlSeconds).toBeGreaterThan(1740);
    expect(ttlSeconds).toBeLessThanOrEqual(1860);
  });
});
