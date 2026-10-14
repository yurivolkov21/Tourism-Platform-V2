import { PgBoss } from 'pg-boss';
import { CATCH_UP_SEND_OPTIONS, type CatchUpSend, sendDailyCatchUp } from './daily-catch-up.js';

/**
 * G41 trên pg-boss THẬT (ADR-0024 AMEND 5). "Mỗi ngày UTC nhiều nhất một lượt bù" là hành
 * vi của thư viện — chỉ mục duy nhất `job_i4` trên `(name, singleton_on, singleton_key)` —
 * nên unit spec không thấy được; đọc sai nó là hoặc mỗi lần máy thức lại dọn một lượt,
 * hoặc không bao giờ bù.
 *
 * Queue tạo với policy `short` như ba queue dọn dẹp ở `start-worker.ts`. Tên riêng mỗi lượt
 * chạy: schema `pgboss` của `tourism_test` không bị dọn giữa các lượt (xem
 * `pgboss.int.spec.ts`), và khoá ngày sống qua lượt chạy trước nếu dùng chung tên.
 */
const RUN = Date.now();
const queueName = (label: string) => `catch-up-int-${RUN}-${label}`;

let boss: PgBoss;
const created: string[] = [];

// Y HỆT biểu thức `start-worker.ts` truyền vào — test đi lệch một chữ là hết soi.
const send: CatchUpSend = (queue, data, options) => boss.send(queue, data, options);

async function createQueue(label: string) {
  const name = queueName(label);
  await boss.createQueue(name, { policy: 'short' });
  created.push(name);
  return name;
}

/** Đọc job bù của queue thẳng từ bảng của pg-boss, so mốc ngày NGAY TRONG Postgres. */
async function catchUpJobs(queue: string) {
  // `singleton_on` là `timestamp` không múi giờ, node-postgres đọc nó theo giờ máy: so trong
  // SQL để test không đỏ trên máy dev giờ Việt Nam.
  const { rows } = await boss.getDb().executeSql(
    `SELECT state,
            singleton_on = date_trunc('day', now() AT TIME ZONE 'UTC') AS on_today_utc,
            extract(epoch FROM start_after - created_on) AS delay_seconds
       FROM pgboss.job
      WHERE name = $1 AND singleton_key = $2`,
    [queue, CATCH_UP_SEND_OPTIONS.singletonKey],
  );
  return rows as { state: string; on_today_utc: boolean; delay_seconds: string }[];
}

beforeAll(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set (vitest.int.config.ts env)');
  boss = new PgBoss({ connectionString, schema: 'pgboss' });
  await boss.start();
});

afterAll(async () => {
  for (const name of created) await boss.deleteQueue(name);
  await boss.stop({ graceful: true, timeout: 5_000 });
});

describe('sendDailyCatchUp trên pg-boss thật', () => {
  it('lần khởi động thứ hai trong cùng ngày không gửi thêm job bù', async () => {
    const queue = await createQueue('twice');

    const first = await sendDailyCatchUp(send, [queue]);
    const second = await sendDailyCatchUp(send, [queue]);

    expect(first).toEqual({ queued: [queue], skipped: [], failed: [] });
    expect(second).toEqual({ queued: [], skipped: [queue], failed: [] });
    const jobs = await catchUpJobs(queue);
    expect(jobs).toHaveLength(1);
    // Khoá vào 00:00 UTC của hôm nay, chờ một phút mới tới lượt chạy.
    expect(jobs[0]?.on_today_utc).toBe(true);
    expect(Number(jobs[0]?.delay_seconds)).toBeGreaterThanOrEqual(59);
    expect(Number(jobs[0]?.delay_seconds)).toBeLessThanOrEqual(61);
  });

  it('job cron đang chờ (khoá rỗng) không chặn job bù', async () => {
    const queue = await createQueue('cron-waiting');
    // Đúng thứ timekeeper của pg-boss đẩy sang mỗi mốc cron: `send(name, data)` không khoá.
    expect(await boss.send(queue, {})).not.toBeNull();

    await expect(sendDailyCatchUp(send, [queue])).resolves.toEqual({
      queued: [queue],
      skipped: [],
      failed: [],
    });
  });

  it('job bù đã chạy xong trong ngày vẫn chặn lần khởi động sau', async () => {
    const queue = await createQueue('completed');
    await sendDailyCatchUp(send, [queue]);
    // Lấy trước giờ hẹn (bỏ qua `startAfter`) để giả lượt worker đã chạy xong job bù.
    const [job] = await boss.fetch(queue, { ignoreStartAfter: true });
    if (!job) throw new Error('không lấy được job bù vừa gửi');
    await boss.complete(queue, job.id);

    await expect(sendDailyCatchUp(send, [queue])).resolves.toEqual({
      queued: [],
      skipped: [queue],
      failed: [],
    });
    expect((await catchUpJobs(queue)).map((row) => row.state)).toEqual(['completed']);
  });

  it('queue chưa tạo: gửi hỏng rơi vào failed, không ném ra lần khởi động', async () => {
    const queue = queueName('missing');

    const result = await sendDailyCatchUp(send, [queue]);

    expect(result.queued).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.failed.map((entry) => entry.queue)).toEqual([queue]);
  });
});
