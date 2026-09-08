import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { createFastifyAdapter } from '../../bootstrap.js';
import { env } from '../../config/env.js';
import { EmailType, OutboxStatus } from '../../generated/prisma/enums.js';
import { EMAIL_DELIVERER, type EmailDeliverer } from '../../worker/deliverer.js';
import { OutboxService } from '../../worker/outbox.service.js';
import { WorkerModule } from '../../worker/worker.module.js';
import { signSvixPayload } from './svix.js';

/**
 * Integration (Docker PG, db tourism_test) — W4 E6 (ADR-0039 §4): webhook
 * Resend ghi `email_suppressions`, drain SKIP mọi row gửi tới địa chỉ đó.
 * Chữ ký svix ký/verify cục bộ bằng secret giả trong vitest.int.config.ts.
 */

class FakeDeliverer implements EmailDeliverer {
  calls: Array<{ type: EmailType; payload: unknown }> = [];
  async deliver(type: EmailType, payload: unknown): Promise<void> {
    this.calls.push({ type, payload });
  }
}

let app: NestFastifyApplication;
const fakeDeliverer = new FakeDeliverer();
let outbox: OutboxService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const workerModuleRef = await Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(EMAIL_DELIVERER)
    .useValue(fakeDeliverer)
    .compile();
  outbox = workerModuleRef.get(OutboxService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  fakeDeliverer.calls = [];
  await prisma.$executeRawUnsafe('TRUNCATE email_suppressions, outbox RESTART IDENTITY CASCADE');
});

/** POST webhook với chữ ký svix THẬT tính từ secret của config test. */
function postResendWebhook(body: string, opts: { badSignature?: boolean } = {}) {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new Error('int config phải set RESEND_WEBHOOK_SECRET');
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = opts.badSignature
    ? Buffer.from('sai-be-bet').toString('base64')
    : signSvixPayload(secret, id, timestamp, body);
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/resend',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
      'x-forwarded-for': '10.9.0.1',
    },
    payload: body,
  });
}

describe('POST /api/webhooks/resend (int)', () => {
  it('chữ ký sai → 400 mã cố định, KHÔNG ghi suppression nào', async () => {
    const res = await postResendWebhook(
      JSON.stringify({ type: 'email.bounced', data: { to: ['x@example.com'] } }),
      { badSignature: true },
    );
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('WEBHOOK_SIGNATURE_INVALID');
    expect(await prisma.emailSuppression.count()).toBe(0);
  });

  it('email.bounced (hard) → upsert suppression; gọi LẠI cùng địa chỉ giữ bản ghi đầu', async () => {
    const body = JSON.stringify({
      type: 'email.bounced',
      data: { to: ['Bounce@Example.com'], bounce: { type: 'hard' } },
    });
    const res = await postResendWebhook(body);
    expect(res.statusCode).toBe(200);

    const row = await prisma.emailSuppression.findUniqueOrThrow({
      where: { email: 'bounce@example.com' }, // citext — so không phân biệt hoa/thường
    });
    expect(row.reason).toBe('bounced');
    expect(row.source).toBe('resend');

    // Complaint tới SAU trên cùng địa chỉ → bản ghi ĐẦU đứng (update: {}).
    const complained = await postResendWebhook(
      JSON.stringify({ type: 'email.complained', data: { to: ['bounce@example.com'] } }),
    );
    expect(complained.statusCode).toBe(200);
    const after = await prisma.emailSuppression.findUniqueOrThrow({
      where: { email: 'bounce@example.com' },
    });
    expect(after.reason).toBe('bounced');
    expect(after.createdAt).toEqual(row.createdAt);
  });

  it('event loại khác (email.delivered) → 200, không ghi gì', async () => {
    const res = await postResendWebhook(
      JSON.stringify({ type: 'email.delivered', data: { to: ['ok@example.com'] } }),
    );
    expect(res.statusCode).toBe(200);
    expect(await prisma.emailSuppression.count()).toBe(0);
  });

  it('thiếu RESEND_WEBHOOK_SECRET → 503 (không phải 500) — endpoint tự khai chưa cấu hình', async () => {
    const saved = env.RESEND_WEBHOOK_SECRET;
    // Mutate env tại chỗ (object thường, đọc LƯỜI theo request) — khôi phục
    // trong finally để không rò sang test khác.
    env.RESEND_WEBHOOK_SECRET = undefined;
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/resend',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.0.2' },
        payload: '{}',
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().code).toBe('WEBHOOK_NOT_CONFIGURED');
    } finally {
      env.RESEND_WEBHOOK_SECRET = saved;
    }
  });
});

describe('drain SKIP theo suppression (int)', () => {
  it('row tới địa chỉ suppressed → SKIPPED kèm lý do trong lastError, deliverer KHÔNG được gọi — CẢ email giao dịch', async () => {
    await prisma.emailSuppression.create({
      data: { email: 'dead@example.com', reason: 'bounced', source: 'resend' },
    });
    // Email GIAO DỊCH (không phải newsletter) — suppression chặn MỌI loại,
    // khác guard unsubscribedAt chỉ chặn bản tin.
    const row = await prisma.outbox.create({
      data: {
        type: EmailType.BOOKING_CONFIRMATION,
        payload: { email: 'dead@example.com', code: 'BK-DEAD0001' },
        dedupeKey: 'booking-confirmed:suppressed-int',
      },
    });
    const alive = await prisma.outbox.create({
      data: {
        type: EmailType.BOOKING_CONFIRMATION,
        payload: { email: 'alive@example.com', code: 'BK-ALIVE001' },
        dedupeKey: 'booking-confirmed:alive-int',
      },
    });

    const result = await outbox.drainOnce();

    expect(result.skippedSuppressed).toBe(1);
    expect(result.sent).toBe(1);
    expect(fakeDeliverer.calls).toHaveLength(1);

    const skipped = await prisma.outbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(skipped.status).toBe(OutboxStatus.SKIPPED);
    expect(skipped.lastError).toBe('suppressed: bounced (resend)');
    expect(skipped.processedAt).toBeInstanceOf(Date);

    const sent = await prisma.outbox.findUniqueOrThrow({ where: { id: alive.id } });
    expect(sent.status).toBe(OutboxStatus.SENT);
  });

  it('vòng vá review W4: `complained` chỉ chặn BẢN TIN — email giao dịch/auth tới cùng địa chỉ vẫn đi', async () => {
    await prisma.emailSuppression.create({
      data: { email: 'spam.clicker@example.com', reason: 'complained', source: 'resend' },
    });
    const newsletter = await prisma.outbox.create({
      data: {
        type: EmailType.NEWSLETTER_WELCOME,
        payload: { email: 'spam.clicker@example.com', subscriberId: 'x' },
        dedupeKey: 'newsletter-welcome:complained-int',
      },
    });
    const reset = await prisma.outbox.create({
      data: {
        type: EmailType.PASSWORD_RESET,
        payload: { email: 'spam.clicker@example.com', url: 'https://example.test/reset' },
        dedupeKey: 'password-reset:complained-int',
      },
    });

    const result = await outbox.drainOnce();

    expect(result.skippedSuppressed).toBe(1);
    expect(result.sent).toBe(1);
    expect((await prisma.outbox.findUniqueOrThrow({ where: { id: newsletter.id } })).status).toBe(
      OutboxStatus.SKIPPED,
    );
    expect((await prisma.outbox.findUniqueOrThrow({ where: { id: reset.id } })).status).toBe(
      OutboxStatus.SENT,
    );
  });

  it('webhook bounce payload THẬT của Resend (type Permanent) → suppression được ghi; Transient → không', async () => {
    const send = (type: string, to: string) =>
      postResendWebhook(
        JSON.stringify({
          type: 'email.bounced',
          data: { to: [to], bounce: { message: 'x', subType: 'General', type } },
        }),
      );
    expect((await send('Permanent', 'perm@example.com')).statusCode).toBe(200);
    expect((await send('Transient', 'temp@example.com')).statusCode).toBe(200);
    expect(
      await prisma.emailSuppression.findUnique({ where: { email: 'perm@example.com' } }),
    ).not.toBeNull();
    expect(
      await prisma.emailSuppression.findUnique({ where: { email: 'temp@example.com' } }),
    ).toBeNull();
  });
});
