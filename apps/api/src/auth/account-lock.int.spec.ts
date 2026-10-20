import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { EmailType } from '../generated/prisma/enums.js';
import { sessionCookie } from '../test/session-cookie.js';
import { prisma } from './auth.config.js';

/**
 * Integration (Docker PG, db tourism_test) — khoá tài khoản (ADR-0052 §4): hook
 * `session.create.before` chặn MỌI đường tạo phiên (đo ở đây mật khẩu; hai đường Google — ID
 * token của app và callback của web — đo ở `google-sign-in.int.spec.ts`; đăng nhập bằng OTP
 * email đã tắt, ADR-0017 §12),
 * và AuthGuard trả 401 cho một phiên sót — phiên được ghi đúng lúc lệnh khoá đang chạy.
 *
 * Fixture khoá bằng cách ghi THẲNG `locked_at`: lệnh khoá thật của Owner (xoá phiên, ghi
 * lịch sử) là việc của `admin-users.int.spec.ts`.
 */

const PASSWORD = 'password-123';
const EMAIL = 'locked-user@tourism.test';

describe('khoá tài khoản chặn mọi phiên (ADR-0052 §4)', () => {
  let app: NestFastifyApplication;

  const signIn = () =>
    app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: EMAIL, password: PASSWORD },
    });
  const setLocked = (locked: boolean) =>
    prisma.user.update({ where: { email: EMAIL }, data: { lockedAt: locked ? new Date() : null } });
  const sessionCount = () => prisma.session.count({ where: { user: { email: EMAIL } } });
  const mine = (cookie: string) =>
    app.inject({ method: 'GET', url: '/api/bookings', headers: { cookie } });

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, outbox CASCADE',
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: EMAIL, password: PASSWORD, name: 'Locked Person' },
    });
    await prisma.user.update({ where: { email: EMAIL }, data: { emailVerified: true } });
  });

  beforeEach(async () => {
    await prisma.session.deleteMany({ where: { user: { email: EMAIL } } });
    await setLocked(false);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, outbox CASCADE',
    );
    await app.close();
  });

  it('đối chứng: chưa khoá thì đăng nhập mật khẩu được', async () => {
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(await sessionCount()).toBe(1);
  });

  it('khoá → đăng nhập mật khẩu 403 ACCOUNT_LOCKED, không phiên nào được ghi', async () => {
    await setLocked(true);
    const res = await signIn();
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'ACCOUNT_LOCKED' });
    expect(await sessionCount()).toBe(0);
  });

  it('khoá → OTP email không còn là đường đăng nhập: route gửi mã từ chối loại sign-in, route đăng nhập 404', async () => {
    // Trước review L1 (20/10) đây là đường thứ hai hook phải chặn. Nay đăng nhập bằng OTP
    // tắt hẳn (ADR-0017 §12), nên phần còn đo là đường ấy đóng với cả tài khoản bị khoá.
    await setLocked(true);
    // Thư OTP của lần đăng ký ở beforeAll đã nằm trong outbox; chỉ đếm phần tăng thêm.
    const otpRows = () => prisma.outbox.count({ where: { type: EmailType.EMAIL_OTP } });
    const before = await otpRows();
    const sent = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      payload: { email: EMAIL, type: 'sign-in' },
    });
    expect(sent.statusCode).toBe(400);
    expect(await otpRows()).toBe(before);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email-otp',
      payload: { email: EMAIL, otp: '000000' },
    });
    expect(res.statusCode).toBe(404);
    expect(await sessionCount()).toBe(0);
  });

  it('phiên sót của tài khoản bị khoá → 401; get-session vẫn mang lockedAt cho web và admin', async () => {
    const cookie = sessionCookie(await signIn());
    expect((await mine(cookie)).statusCode).toBe(200);

    // KHÔNG xoá phiên: mô phỏng phiên được ghi đúng lúc lệnh khoá đang chạy.
    await setLocked(true);

    expect((await mine(cookie)).statusCode).toBe(401);
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie },
    });
    expect(session.json()).toMatchObject({ user: { email: EMAIL } });
    // Chuỗi ISO — `.not.toBeNull()` sẽ xanh giả khi field vắng hẳn (undefined).
    expect(session.json().user.lockedAt).toEqual(expect.any(String));
  });

  it('mở khoá → đăng nhập lại được ngay', async () => {
    await setLocked(true);
    expect((await signIn()).statusCode).toBe(403);
    await setLocked(false);
    expect((await signIn()).statusCode).toBe(200);
  });
});
