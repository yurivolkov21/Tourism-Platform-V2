import { Client } from 'pg';
import { PgBoss } from 'pg-boss';
import { prisma } from '../auth/auth.config.js';
import {
  PGBOSS_POOL_MAX,
  PRISMA_APPLICATION_NAME,
  PRISMA_POOL_MAX,
  pgBossPoolConfig,
} from './db-pool.js';

/**
 * G23 (ADR-0024 AMEND 4) trên Postgres thật: hai pool của tiến trình API giữ đúng trần
 * khi bị dồn việc. Unit spec chỉ khoá con số trong cấu hình; ở đây đếm phiên THẬT trong
 * `pg_stat_activity` theo tên phiên, nên lệch dây (adapter bỏ qua `max`, tên phiên
 * không tới server) là đỏ. Phiên đo đi bằng một client riêng, tên khác hai pool.
 */
const PROBE_APPLICATION_NAME = 'db-pool-g23-probe';

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set (vitest.int.config.ts env)');
  return url;
}

async function countSessions(probe: Client, applicationName: string): Promise<number> {
  const { rows } = await probe.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND application_name = $1',
    [applicationName],
  );
  return rows[0]?.n ?? 0;
}

/** Đếm phiên mỗi 20ms trong lúc `work` chạy; trả về số lớn nhất từng thấy. */
async function peakSessionsDuring(
  probe: Client,
  applicationName: string,
  work: () => Promise<void>,
): Promise<number> {
  let peak = 0;
  let running = true;
  const sampler = (async () => {
    while (running) {
      peak = Math.max(peak, await countSessions(probe, applicationName));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  })();
  try {
    await work();
  } finally {
    running = false;
    await sampler;
  }
  return Math.max(peak, await countSessions(probe, applicationName));
}

describe('trần pool trên Postgres thật (G23)', () => {
  let probe: Client;

  beforeAll(async () => {
    probe = new Client({
      connectionString: databaseUrl(),
      application_name: PROBE_APPLICATION_NAME,
    });
    await probe.connect();
  });

  afterAll(async () => {
    await probe.end();
  });

  it('Prisma bị dồn gấp ba trần vẫn chỉ mở đúng PRISMA_POOL_MAX phiên, và mọi câu đều xong', async () => {
    const burst = PRISMA_POOL_MAX * 3;
    let finished = 0;
    const peak = await peakSessionsDuring(probe, PRISMA_APPLICATION_NAME, async () => {
      await Promise.all(
        Array.from({ length: burst }, async () => {
          await prisma.$queryRaw`SELECT 1 FROM pg_sleep(0.2)`;
          finished += 1;
        }),
      );
    });

    expect(finished).toBe(burst);
    // Bằng chứ không chỉ nhỏ hơn: dồn gấp ba thì pool phải đầy, và số 0 nghĩa là tên
    // phiên không tới server — log Supavisor lại thấy phiên Prisma tên `Supavisor` như cũ.
    expect(peak).toBe(PRISMA_POOL_MAX);
  });

  it('pg-boss với cấu hình production chạy sáu hàng đợi mà không mở quá PGBOSS_POOL_MAX phiên', async () => {
    const boss = new PgBoss({ ...pgBossPoolConfig(databaseUrl()), schema: 'pgboss' });
    const errors: Error[] = [];
    boss.on('error', (err) => errors.push(err));
    // Sáu hàng như sáu vòng poll của start-worker.ts. Schema `pgboss` không bị truncate
    // giữa các lượt chạy, nên xoá hàng cũ trước khi đếm job.
    const queues = Array.from({ length: 6 }, (_, i) => `db-pool-g23-${i}`);
    let done = 0;

    const peak = await peakSessionsDuring(probe, 'pgboss', async () => {
      await boss.start();
      try {
        for (const queue of queues) {
          await boss.deleteQueue(queue);
          await boss.createQueue(queue);
          await boss.work(queue, { pollingIntervalSeconds: 0.5 }, async () => {
            done += 1;
          });
        }
        await Promise.all(queues.map((queue) => boss.send(queue, {})));
        const deadline = Date.now() + 15_000;
        while (done < queues.length && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        for (const queue of queues) await boss.offWork(queue);
        for (const queue of queues) await boss.deleteQueue(queue);
      } finally {
        await boss.stop({ graceful: true, timeout: 5_000 });
      }
    });

    expect(done).toBe(queues.length);
    expect(errors).toEqual([]);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(PGBOSS_POOL_MAX);
  });
});
