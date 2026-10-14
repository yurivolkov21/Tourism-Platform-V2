import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ADMIN_ACCESS, type AdminProcedureEntry, listAdminProcedures } from '@tourism/contract';
import { AppModule } from '../app.module.js';
import { UserRole } from '../generated/prisma/enums.js';
import { sessionCookie } from '../test/session-cookie.js';
import { prisma } from './auth.config.js';

/**
 * Integration (Docker PG, db tourism_test) — bảng quyền admin áp ĐÚNG ở API (ADR-0052 §3,
 * plan P4f quyết định 14). Gọi MỌI thủ tục `contract.admin.*` bằng ba phiên: khách, Staff,
 * Owner. Method và path đọc từ contract, nên thủ tục mới thêm tự vào lưới này.
 *
 * Không thủ tục nào chạy thật: mọi `{param}` thay bằng một uuid không tồn tại, GET không
 * body, POST body `{}` — AuthGuard quyết 401/403 TRƯỚC khi oRPC đọc input, nên thứ bị đo là
 * cổng quyền; qua được cổng thì dừng ở 400/404.
 */

const PASSWORD = 'password-123';
const PLACEHOLDER = '00000000-0000-4000-8000-0000000000f4';

describe('bảng quyền admin áp đúng ở API (ADR-0052)', () => {
  let app: NestFastifyApplication;
  const cookie = { owner: '', staff: '', customer: '' };

  async function signUpAs(email: string, role: UserRole): Promise<string> {
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name: 'Sweep' },
    });
    await prisma.user.update({ where: { email }, data: { emailVerified: true, role } });
    return sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: PASSWORD },
      }),
    );
  }

  const call = (entry: AdminProcedureEntry, sessionCookieValue: string) =>
    app.inject({
      method: entry.method as 'GET' | 'POST',
      url: entry.path.replace(/\{[^}]+\}/g, PLACEHOLDER),
      headers: { cookie: sessionCookieValue },
      ...(entry.method === 'GET' ? {} : { payload: {} }),
    });

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

    cookie.owner = await signUpAs('owner-sweep@tourism.test', UserRole.ADMIN);
    cookie.staff = await signUpAs('staff-sweep@tourism.test', UserRole.STAFF);
    cookie.customer = await signUpAs('customer-sweep@tourism.test', UserRole.CUSTOMER);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications CASCADE',
    );
    await app.close();
  });

  it('bản liệt kê đủ mọi khoá của bảng quyền', () => {
    expect(listAdminProcedures().length).toBe(Object.keys(ADMIN_ACCESS).length);
  });

  it('khách thường: 403 ở MỌI thủ tục admin', async () => {
    for (const entry of listAdminProcedures()) {
      const res = await call(entry, cookie.customer);
      expect(res.statusCode, `${entry.method} ${entry.path} (${entry.key})`).toBe(403);
    }
  });

  it('Staff: thủ tục owner → 403; thủ tục staff → qua cổng quyền', async () => {
    for (const entry of listAdminProcedures()) {
      const res = await call(entry, cookie.staff);
      const label = `${entry.method} ${entry.path} (${entry.key})`;
      if (ADMIN_ACCESS[entry.key] === 'owner') {
        expect(res.statusCode, label).toBe(403);
      } else {
        expect([401, 403], label).not.toContain(res.statusCode);
      }
    }
  });

  it('Owner: qua cổng quyền ở MỌI thủ tục', async () => {
    for (const entry of listAdminProcedures()) {
      const res = await call(entry, cookie.owner);
      expect([401, 403], `${entry.method} ${entry.path} (${entry.key})`).not.toContain(
        res.statusCode,
      );
    }
  });
});
