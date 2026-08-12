import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { prisma } from './auth.config.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Chốt endpoint account.setAvatar (ADR-0021 Task 5): 401 chưa đăng nhập, ghi
 * URL delivery khi publicId đúng folder của mình (và /api/account/me phản
 * chiếu), 400 AVATAR_PUBLIC_ID_INVALID khi publicId ngoài phạm vi, null gỡ
 * avatar.
 *
 * Dùng `new FastifyAdapter()` trần (khuôn reviews.int.spec.ts) — controller
 * này KHÔNG có ThrottlerGuard nên không cần createFastifyAdapter()/trustProxy
 * như upload-signing.int.spec.ts (Task 4).
 */

const PASSWORD = 'password-123';

let app: NestFastifyApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE users, sessions, accounts RESTART IDENTITY CASCADE');
});

/** Lấy cookie pair (name=value) từ set-cookie của inject response. */
// Nguồn: upload-signing.int.spec.ts sessionCookie() — hàm file-local không export.
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
 * Nguồn: upload-signing.int.spec.ts signUpAndSignIn() — hàm file-local không
 * export, chép lại nguyên khuôn.
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

function setAvatarReq(payload: Record<string, unknown>, cookie?: string) {
  return app.inject({
    method: 'PATCH',
    url: '/api/account/avatar',
    headers: cookie ? { cookie } : {},
    payload,
  });
}

describe('account.setAvatar', () => {
  it('chưa đăng nhập → 401', async () => {
    const res = await setAvatarReq({ publicId: 'tourism/avatars/some-user/pid-1' });
    expect(res.statusCode).toBe(401);
  });

  it('publicId đúng folder của mình → 200, image là URL delivery; /api/account/me phản chiếu', async () => {
    const { cookie, userId } = await signUpAndSignIn('avatar-owner@example.com');

    const res = await setAvatarReq({ publicId: `tourism/avatars/${userId}/pid-1` }, cookie);

    expect(res.statusCode).toBe(200);
    expect(res.json().image).toBe(
      `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/avatars/${userId}/pid-1`,
    );

    const me = await app.inject({ method: 'GET', url: '/api/account/me', headers: { cookie } });
    expect(me.json().image).toBe(res.json().image);
  });

  it('publicId ở folder người khác / folder reviews → 400 AVATAR_PUBLIC_ID_INVALID', async () => {
    const owner = await signUpAndSignIn('avatar-owner2@example.com');
    const other = await signUpAndSignIn('avatar-other@example.com');

    // Folder của user KHÁC — không phải của chính chủ.
    const resOtherFolder = await setAvatarReq(
      { publicId: `tourism/avatars/${other.userId}/pid-1` },
      owner.cookie,
    );
    expect(resOtherFolder.statusCode).toBe(400);
    expect(resOtherFolder.json().code).toBe('AVATAR_PUBLIC_ID_INVALID');

    // Folder reviews — cùng root nhưng không phải nhánh avatars.
    const resReviewFolder = await setAvatarReq(
      { publicId: 'tourism/reviews/BK-TESTREV1/pid-1' },
      owner.cookie,
    );
    expect(resReviewFolder.statusCode).toBe(400);
    expect(resReviewFolder.json().code).toBe('AVATAR_PUBLIC_ID_INVALID');
  });

  it('null → gỡ avatar, image về null', async () => {
    const { cookie, userId } = await signUpAndSignIn('avatar-clear@example.com');
    await setAvatarReq({ publicId: `tourism/avatars/${userId}/pid-1` }, cookie);

    const res = await setAvatarReq({ publicId: null }, cookie);

    expect(res.statusCode).toBe(200);
    expect(res.json().image).toBeNull();

    const me = await app.inject({ method: 'GET', url: '/api/account/me', headers: { cookie } });
    expect(me.json().image).toBeNull();
  });
});
