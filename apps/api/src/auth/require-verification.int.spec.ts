import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { EmailType } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/**
 * Siết verify email (quyết định user 20/08 — đảo `requireEmailVerification:
 * false` của 03/08 sau khi tester lách được bước OTP): "bỏ qua verify = chưa
 * có tài khoản để dùng".
 *
 * Ma trận hành vi ĐÍCH, đo bằng int test trước khi chỉnh web:
 *  a. signup KHÔNG phát session dùng được — bỏ qua OTP thì là khách vãng lai.
 *  b. login khi chưa verify → 403, body.code === 'EMAIL_NOT_VERIFIED'
 *     (form web/admin bắt code này để dẫn sang /verify-email).
 *  c. verify OTP xong → login bình thường, session sống.
 */

const PASSWORD = 'password-123';
const EMAIL = 'require-verify@example.com';

async function signUp(app: NestFastifyApplication, email: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: PASSWORD, name: 'Require Verify' },
  });
}

async function signIn(app: NestFastifyApplication, email: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email, password: PASSWORD },
  });
}

/** OTP mới nhất trong outbox cho email — signup gửi qua sendOnSignUp. */
async function latestOtp(email: string): Promise<string> {
  const rows = await prisma.outbox.findMany({
    where: { type: EmailType.EMAIL_OTP },
    orderBy: { createdAt: 'desc' },
  });
  const row = rows.find((r) => (r.payload as { email?: string }).email === email);
  const otp = (row?.payload as { otp?: string } | undefined)?.otp;
  if (!otp) throw new Error('không thấy OTP trong outbox');
  return otp;
}

/** Cookie session (nếu có) từ set-cookie. */
function maybeSessionCookie(res: { headers: Record<string, unknown> }): string | null {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  return session?.split(';')[0] ?? null;
}

describe('requireEmailVerification (siết 20/08)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, outbox CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('a. signup không phát session dùng được — bỏ qua OTP là khách vãng lai', async () => {
    const res = await signUp(app, EMAIL);
    expect(res.statusCode).toBeLessThan(400);

    const cookie = maybeSessionCookie(res);
    if (cookie) {
      // Nếu BA vẫn set cookie thì nó phải KHÔNG đổi ra session sống.
      const who = await app.inject({
        method: 'GET',
        url: '/api/auth/get-session',
        headers: { cookie },
      });
      expect(who.json()).toBeNull();
    }
  });

  it('b. login chưa verify → 403 EMAIL_NOT_VERIFIED (form bắt code này)', async () => {
    await signUp(app, EMAIL);
    const res = await signIn(app, EMAIL);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('c. verify OTP xong → login bình thường, session sống', async () => {
    await signUp(app, EMAIL);
    const otp = await latestOtp(EMAIL);
    const verify = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/verify-email',
      payload: { email: EMAIL, otp },
    });
    expect(verify.statusCode).toBeLessThan(400);

    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(user?.emailVerified).toBe(true);

    const login = await signIn(app, EMAIL);
    expect(login.statusCode).toBe(200);
    const cookie = maybeSessionCookie(login);
    expect(cookie).toBeTruthy();
    const who = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie: cookie as string },
    });
    expect(who.json()?.user?.email).toBe(EMAIL);
  });

  it('d. ĐO hành vi verify-email: có tự đăng nhập không? (chốt flow web)', async () => {
    // Không assert cứng — in kết quả đo để chốt UX: verify xong web đưa khách
    // vào thẳng (nếu BA phát session) hay đưa về /login (nếu không).
    await signUp(app, EMAIL);
    const otp = await latestOtp(EMAIL);
    const verify = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/verify-email',
      payload: { email: EMAIL, otp },
    });
    const cookie = maybeSessionCookie(verify);
    if (cookie) {
      const who = await app.inject({
        method: 'GET',
        url: '/api/auth/get-session',
        headers: { cookie },
      });
      console.log('[đo] verify-email PHÁT session:', who.json()?.user?.email ?? 'cookie chết');
    } else {
      console.log('[đo] verify-email KHÔNG phát session — web phải đưa về /login');
    }
    expect(verify.statusCode).toBeLessThan(400);
  });
});
