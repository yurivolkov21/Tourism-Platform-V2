import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminUserDetailSchema,
  AdminUserLockResultSchema,
  AdminUserRevokeSessionsResultSchema,
  AdminUserSetRoleResultSchema,
  AdminUsersListResultSchema,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { UserEventType, UserRole } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test) — vùng Users (P4f, spec §4 và §6). Năm tài khoản
 * sống cùng một tài khoản đã xoá; mỗi ca tự dựng thứ nó cần (phiên, enquiry, account Google)
 * trên nền `beforeEach` trả role và khoá về đầu.
 *
 * "Phiên bị xoá" luôn kiểm bằng request thật sau lệnh (bài học 2): đếm hàng `sessions` thôi
 * thì không chứng minh được cookie đang cầm đã chết.
 */

const PASSWORD = 'password-123';
const OWNER = 'owner-users@tourism.test';
const STAFF = 'staff-users@tourism.test';
const ADA = 'ada-users@tourism.test';
const BOB = 'bob-users@tourism.test'; // CHƯA xác minh email
const CARA = 'cara-users@tourism.test';
const GONE = 'gone-users@tourism.test'; // tombstone
const MISSING_ID = 'f4f00001-0000-4000-8000-999999999999';

const MINUTE = 60_000;
const at = (minutesAgo: number): Date => new Date(Date.now() - minutesAgo * MINUTE);

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

describe('admin users integration (P4f)', () => {
  let app: NestFastifyApplication;
  let ownerCookie: string;
  const ids = new Map<string, string>();

  const idOf = (email: string): string => {
    const id = ids.get(email);
    if (!id) throw new Error(`fixture thiếu ${email}`);
    return id;
  };
  const get = (url: string, cookie: string) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const post = (url: string, cookie: string, payload: Record<string, unknown> = {}) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const signIn = async (email: string): Promise<string> =>
    sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: PASSWORD },
      }),
    );
  /** Một route bất kỳ cần đăng nhập — 200 là phiên còn sống, 401 là đã chết. */
  const alive = async (cookie: string) => (await get('/api/bookings', cookie)).statusCode;
  const eventsOf = (email: string) =>
    prisma.userEvent.findMany({
      where: { userId: idOf(email) },
      orderBy: { createdAt: 'asc' },
    });
  const list = async (query: string) => {
    const res = await get(`/api/admin/users${query}`, ownerCookie);
    expect(res.statusCode).toBe(200);
    return AdminUsersListResultSchema.parse(res.json());
  };
  const detail = async (email: string) => {
    const res = await get(`/api/admin/users/${idOf(email)}`, ownerCookie);
    expect(res.statusCode).toBe(200);
    return AdminUserDetailSchema.parse(res.json());
  };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications CASCADE',
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // [email, tên, số phút trước] — CARA mới nhất, OWNER cũ nhất.
    const people: Array<[string, string, number]> = [
      [OWNER, 'Owner Olive', 5],
      [STAFF, 'Staff Sam', 4],
      [ADA, 'Ada Lovelace', 3],
      [BOB, 'Bob Builder', 2],
      [CARA, 'Cara Mia', 1],
    ];
    for (const [email, name] of people) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name },
      });
    }
    for (const [email, , minutesAgo] of people) {
      const user = await prisma.user.update({
        where: { email },
        data: { emailVerified: email !== BOB, createdAt: at(minutesAgo) },
      });
      ids.set(email, user.id);
    }
    const gone = await prisma.user.create({
      data: { email: GONE, name: 'Gone Away', emailVerified: true, deletedAt: at(30) },
    });
    ids.set(GONE, gone.id);

    await prisma.user.update({ where: { email: OWNER }, data: { role: UserRole.ADMIN } });
    ownerCookie = await signIn(OWNER);
  });

  beforeEach(async () => {
    await prisma.userEvent.deleteMany();
    await prisma.enquiry.deleteMany();
    await prisma.account.deleteMany({ where: { providerId: 'google' } });
    await prisma.session.deleteMany({ where: { userId: { not: idOf(OWNER) } } });
    await prisma.user.update({
      where: { email: OWNER },
      data: { role: UserRole.ADMIN, lockedAt: null },
    });
    await prisma.user.update({
      where: { email: STAFF },
      data: { role: UserRole.STAFF, lockedAt: null },
    });
    for (const email of [ADA, BOB, CARA]) {
      await prisma.user.update({
        where: { email },
        data: { role: UserRole.CUSTOMER, lockedAt: null },
      });
    }
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications CASCADE',
    );
    await app.close();
  });

  describe('list', () => {
    it('mặc định: mọi tài khoản còn sống, mới nhất trước; tài khoản đã xoá không có mặt', async () => {
      await signIn(STAFF);
      await signIn(ADA);
      const page = await list('');
      expect(page.items.map((row) => row.email)).toEqual([CARA, BOB, ADA, STAFF, OWNER]);
      expect(page.total).toBe(5);
      const byEmail = new Map(page.items.map((row) => [row.email, row]));
      expect(byEmail.get(OWNER)).toMatchObject({ role: 'ADMIN', status: 'active' });
      expect(byEmail.get(STAFF)).toMatchObject({ role: 'STAFF', status: 'active' });
      expect(byEmail.get(BOB)).toMatchObject({ status: 'unverified', lastActiveAt: null });
      expect(byEmail.get(ADA)?.lastActiveAt).not.toBeNull();
      expect(byEmail.get(CARA)?.lastActiveAt).toBeNull();
    });

    it('view=staff chỉ Staff; view=locked chỉ tài khoản đang khoá', async () => {
      await prisma.user.update({ where: { email: CARA }, data: { lockedAt: at(1) } });
      expect((await list('?view=staff')).items.map((row) => row.email)).toEqual([STAFF]);
      const locked = await list('?view=locked');
      expect(locked.items.map((row) => row.email)).toEqual([CARA]);
      expect(locked.items[0]?.status).toBe('locked');
    });

    it('search: tên hoặc email, không phân biệt hoa thường; % là chữ, không phải ký tự đại diện', async () => {
      expect((await list('?search=ADA-USERS')).items.map((row) => row.email)).toEqual([ADA]);
      expect((await list('?search=builder')).items.map((row) => row.email)).toEqual([BOB]);
      // Không escape thì '%' khớp cả năm tài khoản.
      expect((await list('?search=%25')).total).toBe(0);
    });

    it('hàng cũ mang email dài hơn mọi trần (ghi trước khi có hook chặn) → list và byId vẫn 200', async () => {
      // Citext không trần nên hàng như vậy có thể đã nằm trong DB. Schema output chặt hơn cột
      // thì oRPC biến cả trang 1 của /users thành 500 (review P4f).
      const longEmail = `${'l'.repeat(330)}@example.com`;
      const legacy = await prisma.user.create({
        data: { email: longEmail, name: 'Long Email', emailVerified: true },
      });
      try {
        expect((await list('')).items[0]?.email).toBe(longEmail);
        const res = await get(`/api/admin/users/${legacy.id}`, ownerCookie);
        expect(res.statusCode).toBe(200);
        expect(AdminUserDetailSchema.parse(res.json()).email).toBe(longEmail);
      } finally {
        await prisma.user.delete({ where: { id: legacy.id } });
      }
    });

    it('Staff gọi users.list → 403 (vùng chỉ Owner)', async () => {
      const staffCookie = await signIn(STAFF);
      expect((await get('/api/admin/users', staffCookie)).statusCode).toBe(403);
    });
  });

  describe('byId', () => {
    it('cách đăng nhập, đếm hoạt động, phiên sống, lịch sử rỗng', async () => {
      await signIn(ADA);
      await prisma.account.create({
        data: { userId: idOf(ADA), providerId: 'google', accountId: 'google-ada' },
      });
      await prisma.enquiry.create({
        data: {
          name: 'Ada Lovelace',
          email: ADA,
          message: 'A question about a private tour for two people.',
          userId: idOf(ADA),
        },
      });
      const ada = await detail(ADA);
      expect(ada).toMatchObject({
        email: ADA,
        name: 'Ada Lovelace',
        role: 'CUSTOMER',
        status: 'active',
        emailVerified: true,
        lockedAt: null,
        lockReason: null,
        signInMethods: ['password', 'google'],
        counts: { bookings: 0, reviews: 0, enquiries: 1 },
        history: [],
      });
      expect(ada.sessions.active).toBe(1);
      expect(ada.sessions.lastActiveAt).not.toBeNull();
    });

    it('tài khoản đã xoá và id lạ → 404 NOT_FOUND; id rác → 400', async () => {
      for (const id of [idOf(GONE), MISSING_ID]) {
        const res = await get(`/api/admin/users/${id}`, ownerCookie);
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      }
      expect((await get('/api/admin/users/not-a-uuid', ownerCookie)).statusCode).toBe(400);
    });
  });

  describe('setRole', () => {
    it('cấp Staff cho khách đã xác minh: role đổi, ghi STAFF_GRANTED, phiên của họ GIỮ', async () => {
      const adaCookie = await signIn(ADA);
      const res = await post(`/api/admin/users/${idOf(ADA)}/role`, ownerCookie, { role: 'STAFF' });
      expect(res.statusCode).toBe(200);
      expect(AdminUserSetRoleResultSchema.parse(res.json())).toEqual({
        id: idOf(ADA),
        role: 'STAFF',
      });
      expect((await prisma.user.findUniqueOrThrow({ where: { email: ADA } })).role).toBe(
        UserRole.STAFF,
      );
      const events = await eventsOf(ADA);
      expect(events.map((e) => [e.type, e.actorId, e.note])).toEqual([
        [UserEventType.STAFF_GRANTED, idOf(OWNER), null],
      ]);
      expect(await alive(adaCookie)).toBe(200);
    });

    it('khách chưa xác minh, khách đang khoá → 409 STATE_CHANGED, không ghi gì', async () => {
      await prisma.user.update({ where: { email: CARA }, data: { lockedAt: at(1) } });
      for (const email of [BOB, CARA]) {
        const res = await post(`/api/admin/users/${idOf(email)}/role`, ownerCookie, {
          role: 'STAFF',
        });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ code: 'STATE_CHANGED' });
        expect((await prisma.user.findUniqueOrThrow({ where: { email } })).role).toBe(
          UserRole.CUSTOMER,
        );
      }
      expect(await prisma.userEvent.count()).toBe(0);
    });

    it('thu Staff: về CUSTOMER, MỌI phiên của họ chết, ghi STAFF_REVOKED', async () => {
      const staffCookie = await signIn(STAFF);
      expect(await alive(staffCookie)).toBe(200);
      const res = await post(`/api/admin/users/${idOf(STAFF)}/role`, ownerCookie, {
        role: 'CUSTOMER',
      });
      expect(res.statusCode).toBe(200);
      expect(await alive(staffCookie)).toBe(401);
      expect((await eventsOf(STAFF)).map((e) => e.type)).toEqual([UserEventType.STAFF_REVOKED]);
    });

    it('Owner — kể cả chính mình — không bao giờ là mục tiêu: 409, role giữ ADMIN', async () => {
      for (const role of ['CUSTOMER', 'STAFF']) {
        const res = await post(`/api/admin/users/${idOf(OWNER)}/role`, ownerCookie, { role });
        expect(res.statusCode).toBe(409);
      }
      expect((await prisma.user.findUniqueOrThrow({ where: { email: OWNER } })).role).toBe(
        UserRole.ADMIN,
      );
      expect(await alive(ownerCookie)).toBe(200);
    });

    it('role ADMIN bị contract từ chối (400) — giao diện không bao giờ đặt được Owner', async () => {
      const res = await post(`/api/admin/users/${idOf(ADA)}/role`, ownerCookie, { role: 'ADMIN' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('lock / unlock', () => {
    it('khoá: đặt locked_at, MỌI phiên chết, lý do được trim, đăng nhập lại bị chặn', async () => {
      const caraCookie = await signIn(CARA);
      const res = await post(`/api/admin/users/${idOf(CARA)}/lock`, ownerCookie, {
        reason: '  Chargeback abuse  ',
      });
      expect(res.statusCode).toBe(200);
      const body = AdminUserLockResultSchema.parse(res.json());
      const db = await prisma.user.findUniqueOrThrow({ where: { email: CARA } });
      expect(db.lockedAt?.toISOString()).toBe(body.lockedAt);
      // Đếm hàng chứ không chỉ gọi thử: vế `lockedAt` của AuthGuard (Task 4) cũng trả 401,
      // nên request một mình không chứng minh được phiên đã bị xoá.
      expect(await prisma.session.count({ where: { userId: idOf(CARA) } })).toBe(0);
      expect(await alive(caraCookie)).toBe(401);
      expect((await eventsOf(CARA)).map((e) => [e.type, e.note])).toEqual([
        [UserEventType.LOCKED, 'Chargeback abuse'],
      ]);
      const again = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: CARA, password: PASSWORD },
      });
      expect(again.json()).toMatchObject({ code: 'ACCOUNT_LOCKED' });
    });

    it('khoá lần hai, khoá Owner → 409; lý do toàn dấu cách → 400', async () => {
      await post(`/api/admin/users/${idOf(CARA)}/lock`, ownerCookie, { reason: 'First' });
      expect(
        (await post(`/api/admin/users/${idOf(CARA)}/lock`, ownerCookie, { reason: 'Again' }))
          .statusCode,
      ).toBe(409);
      expect(
        (await post(`/api/admin/users/${idOf(OWNER)}/lock`, ownerCookie, { reason: 'No' }))
          .statusCode,
      ).toBe(409);
      expect(
        (await post(`/api/admin/users/${idOf(ADA)}/lock`, ownerCookie, { reason: '   ' }))
          .statusCode,
      ).toBe(400);
      expect((await eventsOf(CARA)).map((e) => e.type)).toEqual([UserEventType.LOCKED]);
    });

    it('mở khoá: locked_at về null, ghi UNLOCKED, đăng nhập được; tài khoản không khoá → 409', async () => {
      await post(`/api/admin/users/${idOf(CARA)}/lock`, ownerCookie, { reason: 'Temporary' });
      const res = await post(`/api/admin/users/${idOf(CARA)}/unlock`, ownerCookie);
      expect(res.statusCode).toBe(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { email: CARA } })).lockedAt).toBeNull();
      expect((await eventsOf(CARA)).map((e) => e.type)).toEqual([
        UserEventType.LOCKED,
        UserEventType.UNLOCKED,
      ]);
      expect(await alive(await signIn(CARA))).toBe(200);
      expect((await post(`/api/admin/users/${idOf(ADA)}/unlock`, ownerCookie)).statusCode).toBe(
        409,
      );
    });

    it('chi tiết khi đang khoá mang lockReason; lịch sử mới nhất trước, có tên người làm', async () => {
      await post(`/api/admin/users/${idOf(ADA)}/role`, ownerCookie, { role: 'STAFF' });
      await post(`/api/admin/users/${idOf(ADA)}/lock`, ownerCookie, { reason: 'Left the team' });
      const ada = await detail(ADA);
      expect(ada.status).toBe('locked');
      expect(ada.lockReason).toBe('Left the team');
      expect(ada.history.map((item) => [item.type, item.actor?.name])).toEqual([
        ['LOCKED', 'Owner Olive'],
        ['STAFF_GRANTED', 'Owner Olive'],
      ]);
    });
  });

  describe('revokeSessions', () => {
    it('xoá MỌI phiên, trả số phiên, ghi SESSIONS_REVOKED; tài khoản vẫn đăng nhập lại được', async () => {
      const first = await signIn(ADA);
      const second = await signIn(ADA);
      const res = await post(`/api/admin/users/${idOf(ADA)}/sessions/revoke`, ownerCookie);
      expect(res.statusCode).toBe(200);
      expect(AdminUserRevokeSessionsResultSchema.parse(res.json())).toEqual({
        id: idOf(ADA),
        revoked: 2,
      });
      expect(await alive(first)).toBe(401);
      expect(await alive(second)).toBe(401);
      expect((await eventsOf(ADA)).map((e) => e.type)).toEqual([UserEventType.SESSIONS_REVOKED]);
      expect(await alive(await signIn(ADA))).toBe(200);
    });

    it('không phiên nào vẫn thành công (revoked: 0); Owner → 409', async () => {
      const res = await post(`/api/admin/users/${idOf(BOB)}/sessions/revoke`, ownerCookie);
      expect(AdminUserRevokeSessionsResultSchema.parse(res.json()).revoked).toBe(0);
      expect(
        (await post(`/api/admin/users/${idOf(OWNER)}/sessions/revoke`, ownerCookie)).statusCode,
      ).toBe(409);
      expect(await alive(ownerCookie)).toBe(200);
    });
  });

  it('bốn lệnh ghi với id lạ hoặc tài khoản đã xoá → 404 NOT_FOUND', async () => {
    for (const id of [MISSING_ID, idOf(GONE)]) {
      const calls = [
        post(`/api/admin/users/${id}/role`, ownerCookie, { role: 'STAFF' }),
        post(`/api/admin/users/${id}/lock`, ownerCookie, { reason: 'x' }),
        post(`/api/admin/users/${id}/unlock`, ownerCookie),
        post(`/api/admin/users/${id}/sessions/revoke`, ownerCookie),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      }
    }
    expect(await prisma.userEvent.count()).toBe(0);
  });
});
