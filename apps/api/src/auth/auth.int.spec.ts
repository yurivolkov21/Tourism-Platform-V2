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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, reviews CASCADE',
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

    // Review của user (tourId/bookingId nullable → không cần fixture catalog).
    const review = await prisma.review.create({
      data: { userId: user.id, rating: 5, body: 'Great trip!', authorName: 'Dave' },
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

    // Review flag denormalized bật.
    const flagged = await prisma.review.findUnique({ where: { id: review.id } });
    expect(flagged?.authorDeleted).toBe(true);

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
