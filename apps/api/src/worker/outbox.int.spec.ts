import { Test } from '@nestjs/testing';
import { prisma } from '../auth/auth.config.js';
import { EmailType, OutboxStatus } from '../generated/prisma/enums.js';
import { EMAIL_DELIVERER, type EmailDeliverer } from './deliverer.js';
import { MAX_ATTEMPTS, OutboxService } from './outbox.service.js';
import { WorkerModule } from './worker.module.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Outbox drain state machine + dedupe + retention chạy trên Prisma thật;
 * deliverer là fake chuyển được mode ok/throw, inject qua token
 * EMAIL_DELIVERER (đúng chỗ P2 sẽ cắm Resend).
 */

class FakeDeliverer implements EmailDeliverer {
  mode: 'ok' | 'throw' = 'ok';
  errorMessage = 'fake smtp boom';
  calls: Array<{ type: EmailType; payload: unknown }> = [];

  async deliver(type: EmailType, payload: unknown): Promise<void> {
    this.calls.push({ type, payload });
    if (this.mode === 'throw') throw new Error(this.errorMessage);
  }

  reset(): void {
    this.mode = 'ok';
    this.errorMessage = 'fake smtp boom';
    this.calls = [];
  }
}

describe('outbox worker integration', () => {
  const deliverer = new FakeDeliverer();
  let outbox: OutboxService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(EMAIL_DELIVERER)
      .useValue(deliverer)
      .compile();
    outbox = moduleRef.get(OutboxService);
  });

  beforeEach(async () => {
    deliverer.reset();
    await prisma.outbox.deleteMany();
  });

  afterAll(async () => {
    await prisma.outbox.deleteMany();
  });

  const seed = (dedupeKey: string, patch: { createdAt?: Date } = {}) =>
    prisma.outbox.create({
      data: {
        type: EmailType.ENQUIRY_RECEIVED,
        payload: { enquiryId: dedupeKey },
        dedupeKey,
        ...patch,
      },
    });

  describe('drainOnce', () => {
    it('delivers PENDING rows oldest-first and marks them SENT with processedAt', async () => {
      const older = await seed('enquiry-received:e-older', {
        createdAt: new Date(Date.now() - 60_000),
      });
      const newer = await seed('enquiry-received:e-newer');

      const result = await outbox.drainOnce();

      expect(result).toEqual({ sent: 2, failed: 0, retried: 0, skippedUnsubscribed: 0 });
      expect(deliverer.calls.map((c) => c.payload)).toEqual([
        { enquiryId: 'enquiry-received:e-older' },
        { enquiryId: 'enquiry-received:e-newer' },
      ]);
      for (const id of [older.id, newer.id]) {
        const row = await prisma.outbox.findUniqueOrThrow({ where: { id } });
        expect(row.status).toBe(OutboxStatus.SENT);
        expect(row.processedAt).toBeInstanceOf(Date);
        expect(row.attempts).toBe(0);
      }
    });

    it('người nhận newsletter đã huỷ đăng ký → SKIPPED (không phải SENT), deliverer KHÔNG được gọi', async () => {
      // Vòng vá review F7: trước đây nhánh skip đánh SENT nên card "Sent" và
      // badge của admin đếm cả email chưa từng tới Resend.
      await prisma.subscriber.create({
        data: { email: 'gone@example.com', unsubscribedAt: new Date() },
      });
      const skipped = await prisma.outbox.create({
        data: {
          type: EmailType.NEWSLETTER_WELCOME,
          payload: { email: 'gone@example.com' },
          dedupeKey: 'newsletter-welcome:gone',
        },
      });

      const result = await outbox.drainOnce();

      expect(result).toEqual({ sent: 0, failed: 0, retried: 0, skippedUnsubscribed: 1 });
      expect(deliverer.calls).toEqual([]);
      const row = await prisma.outbox.findUniqueOrThrow({ where: { id: skipped.id } });
      expect(row.status).toBe(OutboxStatus.SKIPPED);
      expect(row.processedAt).toBeInstanceOf(Date);
      await prisma.subscriber.deleteMany({ where: { email: 'gone@example.com' } });
    });

    it('respects batchSize', async () => {
      await seed('enquiry-received:b1', {
        createdAt: new Date(Date.now() - 2000),
      });
      await seed('enquiry-received:b2', {
        createdAt: new Date(Date.now() - 1000),
      });
      await seed('enquiry-received:b3');

      const result = await outbox.drainOnce(2);

      expect(result.sent).toBe(2);
      expect(await prisma.outbox.count({ where: { status: OutboxStatus.PENDING } })).toBe(1);
    });

    it('increments attempts on error, keeps PENDING, then parks FAILED at MAX_ATTEMPTS', async () => {
      deliverer.mode = 'throw';
      // Message dài quá cột → phải bị cắt còn 1000.
      deliverer.errorMessage = 'y'.repeat(2500);
      const row = await seed('enquiry-received:e-doomed');

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const result = await outbox.drainOnce();
        const isLast = attempt === MAX_ATTEMPTS;
        expect(result).toEqual({
          sent: 0,
          failed: isLast ? 1 : 0,
          retried: isLast ? 0 : 1,
          skippedUnsubscribed: 0,
        });

        const updated = await prisma.outbox.findUniqueOrThrow({
          where: { id: row.id },
        });
        expect(updated.attempts).toBe(attempt);
        expect(updated.status).toBe(isLast ? OutboxStatus.FAILED : OutboxStatus.PENDING);
        expect(updated.lastError).toHaveLength(1000);
        expect(updated.processedAt).toBeNull();
      }

      // FAILED là trạng thái đỗ — drain tiếp theo không đụng nữa.
      const after = await outbox.drainOnce();
      expect(after).toEqual({ sent: 0, failed: 0, retried: 0, skippedUnsubscribed: 0 });
      expect(deliverer.calls).toHaveLength(MAX_ATTEMPTS);
    });
  });

  describe('enqueue', () => {
    it('dedupes on dedupeKey — second enqueue is a no-op', async () => {
      const first = await outbox.enqueue(
        EmailType.BOOKING_CONFIRMATION,
        { bookingId: 'b-1' },
        'booking-paid:b-1',
      );
      const second = await outbox.enqueue(
        EmailType.BOOKING_CONFIRMATION,
        { bookingId: 'b-1' },
        'booking-paid:b-1',
      );

      expect(first).toBe(true);
      expect(second).toBe(false);
      const rows = await prisma.outbox.findMany({
        where: { dedupeKey: 'booking-paid:b-1' },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe(OutboxStatus.PENDING);
    });
  });

  describe('purgeSent', () => {
    it('removes only SENT rows older than the cutoff; keeps recent SENT and FAILED', async () => {
      const days = (n: number) => new Date(Date.now() - n * 86_400_000);
      const oldSent = await prisma.outbox.create({
        data: {
          type: EmailType.ENQUIRY_RECEIVED,
          payload: {},
          dedupeKey: 'purge:old-sent',
          status: OutboxStatus.SENT,
          processedAt: days(40),
        },
      });
      const recentSent = await prisma.outbox.create({
        data: {
          type: EmailType.ENQUIRY_RECEIVED,
          payload: {},
          dedupeKey: 'purge:recent-sent',
          status: OutboxStatus.SENT,
          processedAt: days(5),
        },
      });
      const oldFailed = await prisma.outbox.create({
        data: {
          type: EmailType.ENQUIRY_RECEIVED,
          payload: {},
          dedupeKey: 'purge:old-failed',
          status: OutboxStatus.FAILED,
          attempts: MAX_ATTEMPTS,
          createdAt: days(40),
        },
      });
      // SKIPPED dọn cùng lịch với SENT (vòng vá review F7).
      const oldSkipped = await prisma.outbox.create({
        data: {
          type: EmailType.NEWSLETTER_WELCOME,
          payload: {},
          dedupeKey: 'purge:old-skipped',
          status: OutboxStatus.SKIPPED,
          processedAt: days(40),
        },
      });

      const purged = await outbox.purgeSent(30);

      expect(purged).toBe(2);
      expect(await prisma.outbox.findUnique({ where: { id: oldSent.id } })).toBeNull();
      expect(await prisma.outbox.findUnique({ where: { id: oldSkipped.id } })).toBeNull();
      expect(await prisma.outbox.findUnique({ where: { id: recentSent.id } })).not.toBeNull();
      expect(await prisma.outbox.findUnique({ where: { id: oldFailed.id } })).not.toBeNull();
    });
  });
});
