import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { prisma } from './auth.config.js';

/**
 * W2 mục 4 (audit cụm 1 — Thấp): `updateUser({ image })` của Better Auth vẫn
 * mở dù JSDoc AccountService nói "đường avatar đóng" — field nhận CHUỖI BẤT
 * KỲ, tức một URL tuỳ ý (tracking pixel, ảnh ngoài, javascript: nếu FE render
 * ẩu). Hook `user.update.before` bác mọi image ngoài cloud Cloudinary của
 * mình; đường ghi hợp lệ duy nhất vẫn là account.setAvatar (ký + kiểm chủ
 * quyền publicId).
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

describe('hook user.update.before bác image ngoài Cloudinary (W2 mục 4)', () => {
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

  async function signInFresh(email: string): Promise<string> {
    const su = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name: 'A' },
    });
    expect(su.statusCode).toBe(200);
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const si = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: PASSWORD },
    });
    expect(si.statusCode).toBe(200);
    return sessionCookie(si);
  }

  async function updateUser(cookie: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/update-user',
      headers: { cookie, 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
  }

  it('4. cloud Cloudinary KHÁC, và `..` gấp về cloud khác → bị bác (so trên URL đã chuẩn hoá)', async () => {
    const cookie = await signInFresh('avatar-other-cloud@example.com');
    const other = await updateUser(cookie, {
      image: 'https://res.cloudinary.com/not-mine/image/upload/x.jpg',
    });
    expect(other.statusCode).toBe(400);
    const dotdot = await updateUser(cookie, {
      image: 'https://res.cloudinary.com/demo/../not-mine/image/upload/x.jpg',
    });
    expect(dotdot.statusCode).toBe(400);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'avatar-other-cloud@example.com' },
    });
    expect(user.image).toBeNull();
  });

  it('5. `image: null` gỡ avatar; `image: ""` cũng thành null', async () => {
    const cookie = await signInFresh('avatar-null@example.com');
    const url = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/avatars/x/y';
    expect((await updateUser(cookie, { image: url })).statusCode).toBe(200);
    expect((await updateUser(cookie, { image: null })).statusCode).toBe(200);
    let user = await prisma.user.findUniqueOrThrow({ where: { email: 'avatar-null@example.com' } });
    expect(user.image).toBeNull();
    expect((await updateUser(cookie, { image: url })).statusCode).toBe(200);
    expect((await updateUser(cookie, { image: '' })).statusCode).toBe(200);
    user = await prisma.user.findUniqueOrThrow({ where: { email: 'avatar-null@example.com' } });
    expect(user.image).toBeNull();
  });

  it('6. sign-up mang `image` lạ → bị bác ngay lúc TẠO user (hook create.before — kẻ ẩn danh không đặt được avatar)', async () => {
    const su = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'avatar-signup@example.com',
        password: PASSWORD,
        name: 'S',
        image: 'https://evil.example/pixel.png',
      },
    });
    expect(su.statusCode).toBe(400);
    expect(await prisma.user.count({ where: { email: 'avatar-signup@example.com' } })).toBe(0);
  });

  it('1. image trỏ host lạ → bị bác, DB không đổi', async () => {
    const email = 'evil-avatar@example.com';
    const cookie = await signInFresh(email);
    const res = await updateUser(cookie, { image: 'https://evil.example/pixel.png' });
    expect(res.statusCode).toBe(400);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.image).toBeNull();
  });

  it('2. image đúng cloud Cloudinary của mình → đi qua', async () => {
    const email = 'ok-avatar@example.com';
    const cookie = await signInFresh(email);
    // CLOUDINARY_CLOUD_NAME trong int env là default 'demo' (env.ts).
    const url = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/avatars/x/y';
    const res = await updateUser(cookie, { image: url });
    expect(res.statusCode).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.image).toBe(url);
  });

  it('3. update KHÔNG đụng image (đổi name) không bị hook cản', async () => {
    const email = 'rename-only@example.com';
    const cookie = await signInFresh(email);
    const res = await updateUser(cookie, { name: 'Tên Mới' });
    expect(res.statusCode).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.name).toBe('Tên Mới');
  });
});
