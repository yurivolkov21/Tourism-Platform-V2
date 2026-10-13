import { generateKeyPairSync, sign } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { EmailType } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/**
 * Đăng nhập Google đi hết đường thật của Better Auth (ADR-0056 và AMEND 1): nhánh
 * ID token của app (`/sign-in/social`) và callback của web (`/callback/:id`).
 *
 * Không gọi Google thật: `fetch` tới JWKS và token endpoint của Google trả khoá
 * RSA sinh ngay trong test, nên Better Auth vẫn kiểm chữ ký, issuer, audience và
 * tuổi token như ở production. Đây là lưới cho ngoại lệ ảnh Google lúc TẠO tài
 * khoản — ngoại lệ đó dựa vào `ctx.path` mà hook DB nhận được, thứ unit test của
 * `google-avatar.ts` không chạm tới.
 */

/** Khớp `GOOGLE_CLIENT_ID` giả ở `vitest.int.config.ts`. */
const WEB_CLIENT_ID = 'int-test-web.apps.googleusercontent.com';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const KEY_ID = 'int-test-google-key';
const GOOGLE_PHOTO = 'https://lh3.googleusercontent.com/a/int-test-photo=s96-c';
const PASSWORD = 'password-123';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const GOOGLE_JWKS = {
  keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KEY_ID, alg: 'RS256', use: 'sig' }],
};

/** ID token dạng Google ký bằng khoá test; `claims` ghi đè mặc định. */
function googleIdToken(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: KEY_ID, typ: 'JWT' })).toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: WEB_CLIENT_ID,
      iat: now,
      exp: now + 3600,
      email_verified: true,
      ...claims,
    }),
  ).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

/** Ghép `set-cookie` của một response thành header `cookie` cho request kế tiếp. */
function cookieHeader(setCookie: string | string[] | undefined): string {
  const list = setCookie === undefined ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('đăng nhập Google qua Better Auth thật (ADR-0056)', () => {
  let app: NestFastifyApplication;
  /** ID token mà token endpoint giả trả về ở luồng callback của web. */
  let tokenEndpointIdToken: string | undefined;

  beforeAll(async () => {
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === GOOGLE_CERTS_URL) return Response.json(GOOGLE_JWKS);
      if (url === GOOGLE_TOKEN_URL) {
        return Response.json({
          access_token: 'int-test-access-token',
          id_token: tokenEndpointIdToken,
          expires_in: 3599,
          token_type: 'Bearer',
          scope: 'openid email profile',
        });
      }
      return realFetch(input, init);
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    tokenEndpointIdToken = undefined;
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, outbox CASCADE',
    );
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  /** Đúng request app mobile gửi: không cookie, không Origin. */
  async function signInWithIdToken(token: string) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ provider: 'google', idToken: { token } }),
    });
  }

  it('app, tài khoản MỚI: ID token hợp lệ tạo user, phát phiên, giữ ảnh Google (AMEND 1)', async () => {
    const res = await signInWithIdToken(
      googleIdToken({
        sub: 'google-sub-new',
        email: 'new-google@example.com',
        name: 'New Google',
        picture: GOOGLE_PHOTO,
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(cookieHeader(res.headers['set-cookie'])).toContain('session_token');
    const user = await prisma.user.findUnique({ where: { email: 'new-google@example.com' } });
    expect(user?.image).toBe(GOOGLE_PHOTO);
    expect(user?.emailVerified).toBe(true);
  });

  it('app, tài khoản MỚI: ảnh ở host lạ bị bỏ (null), tài khoản vẫn được tạo', async () => {
    const res = await signInWithIdToken(
      googleIdToken({
        sub: 'google-sub-odd-photo',
        email: 'odd-photo@example.com',
        name: 'Odd Photo',
        picture: 'https://evil.example/tracker.png',
      }),
    );

    expect(res.statusCode).toBe(200);
    const user = await prisma.user.findUnique({ where: { email: 'odd-photo@example.com' } });
    expect(user).not.toBeNull();
    expect(user?.image).toBeNull();
  });

  it('app: ID token cấp cho client khác (sai audience) → 401, không tạo user', async () => {
    const res = await signInWithIdToken(
      googleIdToken({
        sub: 'google-sub-other-app',
        email: 'other-app@example.com',
        aud: 'someone-else.apps.googleusercontent.com',
      }),
    );

    expect(res.statusCode).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await prisma.user.count({ where: { email: 'other-app@example.com' } })).toBe(0);
  });

  it('app, tài khoản email CÓ SẴN đã xác minh: Google vào đúng user đó, không chép ảnh Google đè lên', async () => {
    const signUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: 'existing@example.com', password: PASSWORD, name: 'Existing User' },
    });
    expect(signUp.statusCode).toBe(200);
    const existing = await prisma.user.update({
      where: { email: 'existing@example.com' },
      data: { emailVerified: true },
    });

    const res = await signInWithIdToken(
      googleIdToken({
        sub: 'google-sub-existing',
        email: 'existing@example.com',
        name: 'Google Name',
        picture: GOOGLE_PHOTO,
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(await prisma.user.count({ where: { email: 'existing@example.com' } })).toBe(1);
    const providers = await prisma.account.findMany({
      where: { userId: existing.id },
      select: { providerId: true },
    });
    expect(providers.map((row) => row.providerId).sort()).toEqual(['credential', 'google']);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after.name).toBe('Existing User');
    expect(after.image).toBeNull();
  });

  it('web, tài khoản MỚI: callback Google tạo user kèm ảnh Google rồi về đúng callbackURL (AMEND 1)', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      payload: JSON.stringify({ provider: 'google', callbackURL: 'http://localhost:3000/account' }),
    });
    expect(start.statusCode).toBe(200);
    const state = new URL((start.json() as { url: string }).url).searchParams.get('state');
    expect(state).toBeTruthy();

    tokenEndpointIdToken = googleIdToken({
      sub: 'google-sub-web',
      email: 'web-google@example.com',
      name: 'Web Google',
      picture: GOOGLE_PHOTO,
    });
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback/google?code=int-test-code&state=${encodeURIComponent(state ?? '')}`,
      headers: { cookie: cookieHeader(start.headers['set-cookie']) },
    });

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:3000/account');
    expect(cookieHeader(callback.headers['set-cookie'])).toContain('session_token');
    const user = await prisma.user.findUnique({ where: { email: 'web-google@example.com' } });
    expect(user?.image).toBe(GOOGLE_PHOTO);
  });

  it('app, tài khoản ĐANG KHOÁ (ADR-0052 §4): ID token hợp lệ → 403 ACCOUNT_LOCKED, không phát phiên', async () => {
    const token = googleIdToken({
      sub: 'google-sub-locked-app',
      email: 'locked-app@example.com',
      name: 'Locked App',
    });
    expect((await signInWithIdToken(token)).statusCode).toBe(200);
    const user = await prisma.user.update({
      where: { email: 'locked-app@example.com' },
      data: { lockedAt: new Date() },
    });
    await prisma.session.deleteMany({ where: { userId: user.id } });

    const res = await signInWithIdToken(token);

    // Nhánh ID token gọi `createSession` không bọc try: lỗi của hook về thẳng như đăng nhập
    // email, không có redirect — mobile đọc mã qua `mapAuthError`.
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'ACCOUNT_LOCKED' });
    expect(cookieHeader(res.headers['set-cookie'])).not.toMatch(/session_token=[^;]/);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('web, tài khoản ĐANG KHOÁ: callback Google về errorCallbackURL kèm ?error=ACCOUNT_LOCKED, không phát phiên', async () => {
    const idToken = googleIdToken({
      sub: 'google-sub-locked-web',
      email: 'locked-web@example.com',
      name: 'Locked Web',
    });
    expect((await signInWithIdToken(idToken)).statusCode).toBe(200);
    const user = await prisma.user.update({
      where: { email: 'locked-web@example.com' },
      data: { lockedAt: new Date() },
    });
    await prisma.session.deleteMany({ where: { userId: user.id } });

    // Đúng hai URL form đăng nhập của web gửi (login-form.tsx).
    const start = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      payload: JSON.stringify({
        provider: 'google',
        callbackURL: 'http://localhost:3000/account',
        errorCallbackURL: 'http://localhost:3000/login?redirect=%2F',
      }),
    });
    expect(start.statusCode).toBe(200);
    const state = new URL((start.json() as { url: string }).url).searchParams.get('state');
    tokenEndpointIdToken = idToken;
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback/google?code=int-test-code&state=${encodeURIComponent(state ?? '')}`,
      headers: { cookie: cookieHeader(start.headers['set-cookie']) },
    });

    expect(callback.statusCode).toBe(302);
    const location = new URL(String(callback.headers.location));
    expect(`${location.origin}${location.pathname}`).toBe('http://localhost:3000/login');
    expect(location.searchParams.get('redirect')).toBe('/');
    expect(location.searchParams.get('error')).toBe('ACCOUNT_LOCKED');
    expect(cookieHeader(callback.headers['set-cookie'])).not.toMatch(/session_token=[^;]/);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('tài khoản CHỈ có Google: "Forgot password?" tạo được mật khẩu, rồi đăng nhập email được — lối vào admin của Staff (review P4f)', async () => {
    const email = 'google-only@example.com';
    const newPassword = 'new-password-456';
    const signInEmail = () =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: newPassword },
      });
    const created = await signInWithIdToken(
      googleIdToken({ sub: 'google-sub-only', email, name: 'Google Only' }),
    );
    expect(created.statusCode).toBe(200);
    // Đối chứng: chưa có mật khẩu thì form email và mật khẩu (form duy nhất của admin) từ chối.
    expect((await signInEmail()).statusCode).toBe(401);

    const request = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, redirectTo: '/reset-password' }),
    });
    expect(request.statusCode).toBe(200);
    const row = await prisma.outbox.findFirstOrThrow({ where: { type: EmailType.PASSWORD_RESET } });
    const token = new URL((row.payload as { url: string }).url).pathname.split('/').at(-1);
    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ newPassword, token }),
    });
    expect(reset.statusCode).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const providers = await prisma.account.findMany({
      where: { userId: user.id },
      select: { providerId: true },
    });
    expect(providers.map((account) => account.providerId).sort()).toEqual(['credential', 'google']);
    expect((await signInEmail()).statusCode).toBe(200);
  });
});
