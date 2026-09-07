import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { EmailType } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/**
 * ADR-0017 §7a (W2): mật khẩu đổi là phiên cũ CHẾT.
 *
 * - Reset qua token: `revokeSessionsOnPasswordReset` thu hồi TOÀN BỘ phiên —
 *   kẻ cầm cookie trộm được không sống sót qua hành vi tự vệ của nạn nhân.
 * - Đổi mật khẩu khi đang đăng nhập: web gửi `revokeOtherSessions: true` —
 *   test ở đây canh đầu API tôn trọng cờ đó (phiên KHÁC chết, phiên đang
 *   thao tác giữ nguyên), để nâng version Better Auth mà hành vi đổi là đỏ.
 */

const PASSWORD = 'password-123';
const NEW_PASSWORD = 'new-password-456';

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

describe('thu hồi phiên khi đổi/đặt lại mật khẩu (ADR-0017 §7a)', () => {
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
  });

  /** Đăng ký + verify (qua DB — luồng OTP đã có test riêng) + đăng nhập. */
  async function signUpVerifiedAndSignIn(email: string): Promise<string> {
    const su = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name: 'S' },
    });
    expect(su.statusCode).toBe(200);
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    return signIn(email, PASSWORD);
  }

  async function signIn(email: string, password: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    return sessionCookie(res);
  }

  async function probe(cookie: string): Promise<number> {
    const res = await app.inject({ method: 'GET', url: '/api/account/me', headers: { cookie } });
    return res.statusCode;
  }

  it('1. reset mật khẩu qua token → cookie phát TRƯỚC đó thành 401, mật khẩu mới đăng nhập được', async () => {
    const email = 'reset-revoke@example.com';
    const staleCookie = await signUpVerifiedAndSignIn(email);
    expect(await probe(staleCookie)).toBe(200);

    const req = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, redirectTo: '/reset-password' }),
    });
    expect(req.statusCode).toBe(200);

    // Token nằm trong URL của outbox row (sendResetPassword ghi {email, url}).
    const row = await prisma.outbox.findFirstOrThrow({
      where: { type: EmailType.PASSWORD_RESET },
      orderBy: { createdAt: 'desc' },
    });
    const { url } = row.payload as { url: string };
    const token = new URL(url).pathname.split('/').at(-1);
    if (!token) throw new Error(`Không tách được token từ url: ${url}`);

    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ newPassword: NEW_PASSWORD, token }),
    });
    expect(reset.statusCode).toBe(200);

    // Điểm của cả test: phiên cũ KHÔNG sống sót qua reset.
    expect(await probe(staleCookie)).toBe(401);

    const freshCookie = await signIn(email, NEW_PASSWORD);
    expect(await probe(freshCookie)).toBe(200);
  });

  it('2. change-password kèm revokeOtherSessions (cờ web gửi) → phiên KHÁC 401, phiên đang thao tác sống', async () => {
    const email = 'change-revoke@example.com';
    const cookieA = await signUpVerifiedAndSignIn(email);
    const cookieB = await signIn(email, PASSWORD);
    expect(await probe(cookieB)).toBe(200);

    const change = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: cookieA, 'content-type': 'application/json' },
      payload: JSON.stringify({
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        revokeOtherSessions: true,
      }),
    });
    expect(change.statusCode).toBe(200);

    expect(await probe(cookieB)).toBe(401);
    // BA xoá MỌI phiên rồi xoay phiên hiện tại: cookie mới PHẢI có trong
    // response, cookie A cũ chết, cookie mới sống (assert cứng — vòng vá review
    // W2: bản đầu rẽ nhánh theo chính hành vi đang test).
    expect(change.headers['set-cookie']).toBeDefined();
    const rotated = sessionCookie(change);
    expect(rotated).not.toBe(cookieA);
    expect(await probe(cookieA)).toBe(401);
    expect(await probe(rotated)).toBe(200);
  });

  it('3. change-password KHÔNG kèm cờ (client khác/quên) → server vẫn ép thu hồi phiên khác (ADR-0017 §7a, hooks.before)', async () => {
    const email = 'change-forced@example.com';
    const cookieA = await signUpVerifiedAndSignIn(email);
    const cookieB = await signIn(email, PASSWORD);
    const change = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: cookieA, 'content-type': 'application/json' },
      payload: JSON.stringify({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
    });
    expect(change.statusCode).toBe(200);
    expect(await probe(cookieB)).toBe(401);
    expect(await probe(sessionCookie(change))).toBe(200);
  });
});
