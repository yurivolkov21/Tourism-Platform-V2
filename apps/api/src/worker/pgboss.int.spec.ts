import { PgBoss } from 'pg-boss';

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
