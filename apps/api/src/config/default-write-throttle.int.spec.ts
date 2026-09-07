import { Controller, Get, Post } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Throttle } from '@nestjs/throttler';
import { AppModule } from '../app.module.js';
import { prisma } from '../auth/auth.config.js';
import { Public } from '../auth/public.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  ADMIN_WRITE_THROTTLE,
  AUTHED_WRITE_THROTTLE,
  PUBLIC_READ_THROTTLE,
  PUBLIC_WRITE_THROTTLE,
} from './throttle.js';

/**
 * ADR-0037 — trần ghi MẶC ĐỊNH: test này canh cái LƯỚI, không canh route nào
 * cụ thể. ProbeController mô phỏng một route mới toanh KHÔNG khai bất kỳ
 * decorator throttle nào — nếu nó vẫn có trần thì mọi route ghi tương lai
 * sinh ra đã an toàn; nếu test này đỏ nghĩa là mặc định đã bị gỡ và ta quay
 * về thời "nhớ gắn decorator" (bookings.create từng sống không trần từ P2
 * tới W1 đúng vì thế).
 */

const PASSWORD = 'password-123';
const PUBLIC_IP = '203.0.113.50';

@Controller()
class ProbeController {
  /** Route ghi CÔNG KHAI không khai gì → phải ăn PUBLIC_WRITE_THROTTLE theo IP. */
  @Public()
  @Post('throttle-probe/public')
  publicWrite() {
    return { ok: true };
  }

  /** Route ghi ĐÃ-AUTH không khai gì → phải ăn AUTHED_WRITE_THROTTLE theo user. */
  @Post('throttle-probe/authed')
  authedWrite() {
    return { ok: true };
  }

  /** Đường đọc CÔNG KHAI — từ W4 R1 đếm bucket `read` 300/60s theo IP. */
  @Public()
  @Get('throttle-probe/read')
  read() {
    return { ok: true };
  }

  /** Đường đọc công khai THỨ HAI — bucket read là MỘT cho cả IP, không per-route. */
  @Public()
  @Get('throttle-probe/read-2')
  readTwo() {
    return { ok: true };
  }

  /** Đường đọc ĐÃ-AUTH — GET có session KHÔNG đếm (ADR-0037 AMEND 2). */
  @Get('throttle-probe/authed-read')
  authedRead() {
    return { ok: true };
  }

  /** GET public trên route KHAI @Throttle riêng — chính sách riêng thắng,
   * KHÔNG rơi vào bucket read (ca get-session của AuthController). */
  @Public()
  @Throttle({ default: PUBLIC_WRITE_THROTTLE })
  @Get('throttle-probe/declared-read')
  declaredRead() {
    return { ok: true };
  }

  /** Route ghi dưới /api/admin — ADMIN được carve-out 60/60s (AMEND 1), CUSTOMER vẫn 20/60s. */
  @Post('api/admin/throttle-probe')
  adminWrite() {
    return { ok: true };
  }

  /** Route authed KHAI TƯỜNG MINH đúng cặp số public — phải giữ 5/60s, không bị nâng. */
  @Throttle({ default: PUBLIC_WRITE_THROTTLE })
  @Post('throttle-probe/pinned')
  pinnedWrite() {
    return { ok: true };
  }
}

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

describe('trần ghi mặc định toàn cục (ADR-0037)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications CASCADE',
    );
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications CASCADE',
    );
    await app.close();
  });

  async function signUpAndSignIn(email: string): Promise<string> {
    const su = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      remoteAddress: PUBLIC_IP,
      payload: { email, password: PASSWORD, name: 'P' },
    });
    expect(su.statusCode).toBe(200);
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const si = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      remoteAddress: PUBLIC_IP,
      payload: { email, password: PASSWORD },
    });
    expect(si.statusCode).toBe(200);
    return sessionCookie(si);
  }

  it('1. route ghi @Public KHÔNG khai gì vẫn có trần PUBLIC theo IP; IP khác không vạ lây', async () => {
    const post = (ip: string) =>
      app.inject({ method: 'POST', url: '/throttle-probe/public', remoteAddress: ip });
    for (let i = 0; i < PUBLIC_WRITE_THROTTLE.limit; i++) {
      expect((await post('203.0.113.77')).statusCode).toBe(201);
    }
    expect((await post('203.0.113.77')).statusCode).toBe(429);
    expect((await post('203.0.113.78')).statusCode).toBe(201);
  });

  it('2. route ghi ĐÃ-AUTH không khai gì vẫn có trần AUTHED theo user; user khác cùng IP không vạ lây', async () => {
    const alice = await signUpAndSignIn('probe-alice@example.com');
    const bob = await signUpAndSignIn('probe-bob@example.com');
    const post = (cookie: string) =>
      app.inject({
        method: 'POST',
        url: '/throttle-probe/authed',
        remoteAddress: PUBLIC_IP,
        headers: { cookie },
      });
    for (let i = 0; i < AUTHED_WRITE_THROTTLE.limit; i++) {
      expect((await post(alice)).statusCode).toBe(201);
    }
    expect((await post(alice)).statusCode).toBe(429);
    // Cùng IP nhưng bucket theo user — Bob còn nguyên quota.
    expect((await post(bob)).statusCode).toBe(201);
  });

  it('7. W4 R1: GET public đếm bucket `read` 300/60s theo IP, CHUNG cho mọi route đọc; IP khác không vạ lây', async () => {
    const ip = '203.0.113.140';
    const get = (url: string, from = ip) => app.inject({ method: 'GET', url, remoteAddress: from });
    // Chia hạn mức qua HAI route — bucket read là MỘT theo IP (ADR-0037
    // AMEND 2: '6 call/trang' đếm trên cả trang, per-route là nhân trần).
    const half = PUBLIC_READ_THROTTLE.limit / 2;
    for (let i = 0; i < half; i++) {
      expect((await get('/throttle-probe/read')).statusCode).toBe(200);
      expect((await get('/throttle-probe/read-2')).statusCode).toBe(200);
    }
    expect((await get('/throttle-probe/read')).statusCode).toBe(429);
    expect((await get('/throttle-probe/read-2')).statusCode).toBe(429);
    expect((await get('/throttle-probe/read', '203.0.113.141')).statusCode).toBe(200);
  });

  it('8. W4 R1: GET có session KHÔNG đếm — bucket read của IP đầy, authed GET vẫn chạy; và bucket read KHÔNG đụng bucket ghi', async () => {
    const ip = '203.0.113.150';
    const cookie = await signUpAndSignIn('probe-reader@example.com');
    for (let i = 0; i < PUBLIC_READ_THROTTLE.limit + 1; i++) {
      await app.inject({ method: 'GET', url: '/throttle-probe/read', remoteAddress: ip });
    }
    // Đọc public của IP này đã 429...
    expect(
      (await app.inject({ method: 'GET', url: '/throttle-probe/read', remoteAddress: ip }))
        .statusCode,
    ).toBe(429);
    // ...nhưng GET đã-auth (khách đăng nhập là đối tượng của trần GHI) vẫn qua.
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/throttle-probe/authed-read',
        remoteAddress: ip,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
    }
    // Và bucket GHI public của cùng IP còn nguyên — hai bucket tách tên.
    expect(
      (await app.inject({ method: 'POST', url: '/throttle-probe/public', remoteAddress: ip }))
        .statusCode,
    ).toBe(201);
    // GET public trên route KHAI @Throttle riêng cũng KHÔNG bị bucket read
    // chặn — chính sách tường minh thắng mặc định (ca get-session: đếm nó
    // theo IP là cả SSR Vercel chia một bucket).
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/throttle-probe/declared-read',
          remoteAddress: ip,
        })
      ).statusCode,
    ).toBe(200);
  });

  it('3. GET không ăn bucket GHI — bucket write của cùng IP đã đầy, GET vẫn chạy', async () => {
    const ip = '203.0.113.99';
    for (let i = 0; i < PUBLIC_WRITE_THROTTLE.limit + 1; i++) {
      await app.inject({ method: 'POST', url: '/throttle-probe/public', remoteAddress: ip });
    }
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/throttle-probe/read',
        remoteAddress: ip,
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('5. ADMIN dưới /api/admin/* được ADMIN_WRITE_THROTTLE (60/60s); CUSTOMER cùng route vẫn 20/60s (AMEND 1)', async () => {
    const adminCookie = await signUpAndSignIn('probe-admin@example.com');
    await prisma.user.update({
      where: { email: 'probe-admin@example.com' },
      data: { role: UserRole.ADMIN },
    });
    const adminCookie2 = await signUpAndSignIn('probe-admin@example.com'); // phiên mới mang role mới
    void adminCookie;
    const customer = await signUpAndSignIn('probe-customer@example.com');
    const post = (cookie: string) =>
      app.inject({
        method: 'POST',
        url: '/api/admin/throttle-probe',
        remoteAddress: PUBLIC_IP,
        headers: { cookie },
      });
    for (let i = 0; i < ADMIN_WRITE_THROTTLE.limit; i++) {
      expect((await post(adminCookie2)).statusCode).toBe(201);
    }
    expect((await post(adminCookie2)).statusCode).toBe(429);
    for (let i = 0; i < AUTHED_WRITE_THROTTLE.limit; i++) {
      expect((await post(customer)).statusCode).toBe(201);
    }
    expect((await post(customer)).statusCode).toBe(429);
  });

  it('6. route khai @Throttle tường minh TRÙNG số public vẫn giữ 5/60s cho user có session — nhận diện bằng metadata, không so số (AMEND 1)', async () => {
    const cookie = await signUpAndSignIn('probe-pinned@example.com');
    const post = () =>
      app.inject({
        method: 'POST',
        url: '/throttle-probe/pinned',
        remoteAddress: PUBLIC_IP,
        headers: { cookie },
      });
    for (let i = 0; i < PUBLIC_WRITE_THROTTLE.limit; i++) {
      expect((await post()).statusCode).toBe(201);
    }
    expect((await post()).statusCode).toBe(429);
  });

  it('4. non-GET không session, không @Public → 401 từ AuthGuard (fail-closed, không rơi về bucket IP)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/throttle-probe/authed',
      remoteAddress: PUBLIC_IP,
    });
    expect(res.statusCode).toBe(401);
  });
});
