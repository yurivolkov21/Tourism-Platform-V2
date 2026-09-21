import { PgBoss } from 'pg-boss';
import {
  clearOutboxNudge,
  nudgeOutboxDrain,
  OUTBOX_DRAIN_QUEUE,
  registerOutboxNudge,
} from './outbox-nudge.js';

/**
 * Boot smoke cho pg-boss v12 trên Docker PG tourism_test (schema `pgboss`
 * riêng, tách khỏi schema Prisma) — chứng minh v12 + PG version của ta hợp
 * nhau: install schema, start, tạo queue, stop sạch. KHÔNG chờ cron tick
 * (chậm ≥60s) — lifecycle là đủ cho smoke.
 */
describe('pg-boss v12 boot smoke (tourism_test)', () => {
  it('starts, installs its schema, creates a queue, and stops cleanly', async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL not set (vitest.int.config.ts env)');

    const boss = new PgBoss({ connectionString, schema: 'pgboss' });
    const errors: Error[] = [];
    boss.on('error', (err) => errors.push(err));

    await boss.start();
    expect(await boss.isInstalled()).toBe(true);
    expect(await boss.schemaVersion()).toBeGreaterThan(0);

    await boss.createQueue('smoke-test', { policy: 'short' });
    const queue = await boss.getQueue('smoke-test');
    expect(queue?.name).toBe('smoke-test');

    await boss.stop({ graceful: true, timeout: 5_000 });
    expect(errors).toEqual([]);
  });
});

/**
 * Nối dây `nudgeOutboxDrain` với pg-boss THẬT. Unit spec của nó chỉ ghim hợp
 * đồng registry; thứ nó không thấy được là lời gọi `boss.send(queue, {})` ở
 * `start-worker.ts` có đúng chữ ký và queue có nhận không. Bẫy ở đây là nudge
 * NUỐT lỗi: đẩy vào một queue chưa `createQueue` sẽ hỏng ÂM THẦM, nên ca đó
 * phải được ghim tường minh.
 */
describe('nudgeOutboxDrain trên pg-boss thật', () => {
  it('queue đã tạo → job vào hàng đợi; queue chưa tạo → failed chứ không ném', async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL not set (vitest.int.config.ts env)');

    const boss = new PgBoss({ connectionString, schema: 'pgboss' });
    await boss.start();
    // Y HỆT biểu thức start-worker.ts đăng ký — test đi lệch một chữ là hết soi.
    registerOutboxNudge((queue) => boss.send(queue, {}));

    try {
      // Xoá TƯỜNG MINH trước khi khẳng định "chưa tạo". Schema `pgboss` của
      // `tourism_test` KHÔNG bị truncate giữa các lượt (globalSetup chỉ
      // `migrate deploy` schema Prisma), nên queue do lượt chạy trước tạo ra
      // vẫn còn — giả định sạch ở đây làm test xanh lần đầu, đỏ lần hai.
      await boss.deleteQueue(OUTBOX_DRAIN_QUEUE);

      // Chưa createQueue: pg-boss từ chối, nudge nuốt và báo failed.
      expect(await nudgeOutboxDrain()).toBe('failed');

      await boss.createQueue(OUTBOX_DRAIN_QUEUE, { policy: 'short' });
      expect(await nudgeOutboxDrain()).toBe('queued');
      const job = await boss.fetch(OUTBOX_DRAIN_QUEUE);
      expect(job?.length ?? 0).toBeGreaterThan(0);
    } finally {
      clearOutboxNudge();
      await boss.stop({ graceful: true, timeout: 5_000 });
    }
  });
});
