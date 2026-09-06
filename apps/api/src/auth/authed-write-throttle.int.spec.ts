import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { AUTHED_WRITE_THROTTLE } from '../config/throttle.js';
import { prisma } from './auth.config.js';

/**
 * Integration (Docker PG, db tourism_test) — W1 (audit 05/09 cụm 2, mục Vừa):
 * trần tần suất cho endpoint GHI ĐÃ-AUTH, bucket theo `user.id` chứ KHÔNG theo
 * IP. Theo IP thì (a) cả một NAT/proxy chung IP bị khoá oan theo nhau, và (b)
 * một tài khoản đi qua pool IP xoay vòng không bao giờ chạm trần.
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

describe('AUTHED_WRITE_THROTTLE — trần ghi đã-auth theo user (W1)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, bookings CASCADE',
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    // Dọn user/session của file này — spec sau không được thừa hưởng (vòng vá 06/09).
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, bookings, media_garbage CASCADE',
    );
    await app.close();
    await prisma.$disconnect();
  });

  async function signUpUser(email: string, name = 'Throttle User'): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name },
    });
    expect(res.statusCode).toBe(200);
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: PASSWORD },
    });
    expect(signIn.statusCode).toBe(200);
    return sessionCookie(signIn);
  }

  const clearAvatar = (cookie: string) =>
    app.inject({
      method: 'PATCH',
      url: '/api/account/avatar',
      headers: { cookie },
      payload: { publicId: null },
    });

  it('vượt trần trên avatar → 429 cho ĐÚNG user đó; user khác cùng IP vẫn 200', async () => {
    const alice = await signUpUser('throttle-a@example.com');
    const bob = await signUpUser('throttle-b@example.com');

    for (let i = 0; i < AUTHED_WRITE_THROTTLE.limit; i++) {
      expect((await clearAvatar(alice)).statusCode).toBe(200);
    }
    const over = await clearAvatar(alice);
    expect(over.statusCode).toBe(429);

    // Cùng IP (inject 127.0.0.1) nhưng bucket theo user → Bob không bị vạ lây.
    expect((await clearAvatar(bob)).statusCode).toBe(200);
  });

  it('đường ghi booking cũng có trần: spam checkout → 429 (bucket riêng theo route)', async () => {
    const carol = await signUpUser('throttle-c@example.com');
    // Code không tồn tại → bình thường là 404; guard chạy TRƯỚC handler nên
    // vẫn đếm — vượt trần là 429 bất kể handler nói gì. ĐỦ `limit` lượt đầu
    // phải là 404 (bucket riêng theo route: Alice đã đốt bucket avatar ở test
    // trên mà Carol vẫn còn nguyên quota checkout) rồi lượt limit+1 mới 429.
    const post = () =>
      app.inject({
        method: 'POST',
        url: '/api/bookings/BK-NOSUCH00/checkout',
        headers: { cookie: carol },
      });
    for (let i = 0; i < AUTHED_WRITE_THROTTLE.limit; i++) {
      expect((await post()).statusCode).toBe(404);
    }
    expect((await post()).statusCode).toBe(429);
  });
});
