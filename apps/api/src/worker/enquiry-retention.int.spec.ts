import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { AccountService } from '../auth/account.service.js';
import { prisma } from '../auth/auth.config.js';
import { createFastifyAdapter } from '../bootstrap.js';
import { ANONYMIZED_NAME } from '../lib/enquiry-anonymize.js';
import { EnquiryRetentionService } from './enquiry-retention.service.js';
import { WorkerModule } from './worker.module.js';

/**
 * Integration (Docker PG, db tourism_test) — W4 E8 (ADR-0039 §6): retention
 * enquiry 18 tháng anonymize + `enquiries.user_id` ghi lúc có session +
 * deleteAccount kéo theo anonymize ngay trong cùng tx tombstone.
 */

let app: NestFastifyApplication;
let retention: EnquiryRetentionService;

const PASSWORD = 'Enquiry-retention-1!';

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const workerModuleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
  retention = workerModuleRef.get(EnquiryRetentionService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE enquiries, outbox RESTART IDENTITY CASCADE');
});

function monthsAgo(months: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()));
}

const seedEnquiry = (patch: { createdAt?: Date; userId?: string } = {}) =>
  prisma.enquiry.create({
    data: {
      name: 'Old Lead',
      email: 'old.lead@example.com',
      phone: '+84 900 000 000',
      message: 'A message full of personal context that must not outlive retention.',
      ...patch,
    },
  });

describe('enquiry retention sweep (int)', () => {
  it('row quá ngưỡng → anonymize đủ bốn cột + anonymizedAt; row mới KHÔNG bị đụng; chạy lại idempotent', async () => {
    const old = await seedEnquiry({ createdAt: monthsAgo(19) });
    const fresh = await seedEnquiry({ createdAt: monthsAgo(2) });

    const count = await retention.sweep(new Date(), 18);
    expect(count).toBe(1);

    const anonymized = await prisma.enquiry.findUniqueOrThrow({ where: { id: old.id } });
    expect(anonymized.name).toBe(ANONYMIZED_NAME);
    expect(anonymized.email).toBe(`anon-${old.id}@invalid`);
    expect(anonymized.phone).toBeNull();
    expect(anonymized.message).toBe('');
    expect(anonymized.anonymizedAt).toBeInstanceOf(Date);
    // Thống kê lead còn nguyên — anonymize chứ không xoá.
    expect(anonymized.status).toBe(old.status);

    const untouched = await prisma.enquiry.findUniqueOrThrow({ where: { id: fresh.id } });
    expect(untouched.name).toBe('Old Lead');
    expect(untouched.anonymizedAt).toBeNull();

    // Lượt hai không đụng row đã anonymize (guard anonymized_at IS NULL).
    const second = await retention.sweep(new Date(), 18);
    expect(second).toBe(0);
  });
});

describe('enquiries.user_id + deleteAccount (int)', () => {
  it('gửi form lúc CÓ session → user_id ghi; deleteAccount anonymize NGAY enquiry đó, enquiry ẩn danh để yên', async () => {
    // Dựng user thật qua Better Auth (cùng khuôn admin-subscribers spec).
    const email = 'enquiry.owner@example.com';
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      remoteAddress: '10.8.0.1',
      payload: { email, password: PASSWORD, name: 'Enquiry Owner' },
    });
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      remoteAddress: '10.8.0.1',
      payload: { email, password: PASSWORD },
    });
    const cookie = signIn.headers['set-cookie']?.toString().split(';')[0] ?? '';
    expect(cookie).not.toBe('');
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    // Enquiry CÓ session → user_id ghi.
    const withSession = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      remoteAddress: '10.8.0.2',
      headers: { cookie },
      payload: { name: 'Enquiry Owner', email, message: 'Please plan my next trip, thanks!' },
    });
    expect(withSession.statusCode).toBe(200);
    const owned = await prisma.enquiry.findUniqueOrThrow({
      where: { id: withSession.json().id },
    });
    expect(owned.userId).toBe(user.id);

    // Enquiry ẨN DANH (không cookie) → user_id null.
    const anonymous = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      remoteAddress: '10.8.0.3',
      payload: {
        name: 'Stranger',
        email: 'stranger@example.com',
        message: 'Anonymous enquiry that must stay untouched here.',
      },
    });
    expect(anonymous.statusCode).toBe(200);
    expect(
      (await prisma.enquiry.findUniqueOrThrow({ where: { id: anonymous.json().id } })).userId,
    ).toBeNull();

    // deleteAccount → enquiry của user anonymize NGAY (không đợi 18 tháng).
    await app.get(AccountService).deleteAccount(user.id, PASSWORD);

    const afterDelete = await prisma.enquiry.findUniqueOrThrow({ where: { id: owned.id } });
    expect(afterDelete.name).toBe(ANONYMIZED_NAME);
    expect(afterDelete.email).toBe(`anon-${owned.id}@invalid`);
    expect(afterDelete.anonymizedAt).toBeInstanceOf(Date);
    // FK SetNull chỉ chạy khi user bị hard-delete — tombstone giữ row user
    // nên user_id còn nguyên (dấu vết nội bộ, PII đã xoá).
    expect(afterDelete.userId).toBe(user.id);

    // Enquiry của người lạ không bị vạ lây.
    const strangerRow = await prisma.enquiry.findUniqueOrThrow({
      where: { id: anonymous.json().id },
    });
    expect(strangerRow.name).toBe('Stranger');
    expect(strangerRow.anonymizedAt).toBeNull();
  });
});
