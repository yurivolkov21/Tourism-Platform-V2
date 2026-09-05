import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PgBoss } from 'pg-boss';
import { env } from '../config/env.js';
import { MediaGarbageService } from '../modules/media/media-garbage.service.js';
import { OutboxService } from './outbox.service.js';
import { PENDING_TTL_MINUTES, PendingSweepService } from './pending-sweep.service.js';
import { WorkerModule } from './worker.module.js';

/**
 * Khởi động vòng worker (pg-boss cron: outbox drain/purge + booking sweep).
 *
 * Tách từ `worker.ts` (deploy v1, ADR-0024) để HAI entrypoint dùng chung đúng
 * một bản: process riêng (`dist/worker.js` — kiến trúc gốc, Render Background
 * Worker) và INLINE trong tiến trình API (`WORKER_INLINE=true` — Render free
 * không có Background Worker). Nội dung vòng lặp GIỮ NGUYÊN từng queue/cron so
 * với bản trong worker.ts trước đây; chỉ signal-handling ở lại entrypoint vì
 * inline mode dùng shutdown hook của Nest thay vì tự bắt SIGTERM.
 *
 * Trả về hàm `stop` — idempotent, dừng pg-boss graceful rồi đóng app context.
 */
const OUTBOX_DRAIN_QUEUE = 'outbox-drain';
/** Mỗi phút — granularity nhỏ nhất của cron pg-boss. */
const OUTBOX_DRAIN_CRON = '* * * * *';
const OUTBOX_PURGE_QUEUE = 'outbox-purge';
/** Hằng ngày 03:00 UTC (off-peak) — retention audit M5. */
const OUTBOX_PURGE_CRON = '0 3 * * *';
const RETENTION_DAYS = 30;
const BOOKING_SWEEP_QUEUE = 'booking-sweep';
/** Mỗi 10′ — backstop WRK-1 khi webhook expired rớt. */
const BOOKING_SWEEP_CRON = '*/10 * * * *';
const MEDIA_GC_QUEUE = 'media-gc';
/**
 * Hằng ngày 04:00 UTC — sau `outbox-purge` một tiếng để hai job nặng không
 * chồng nhau. Nhịp NGÀY chứ không phút: hàng đợi này không có ai chờ ở đầu
 * kia, và mỗi lượt là một loạt lời gọi API ra ngoài (ADR-0035 §5).
 */
const MEDIA_GC_CRON = '0 4 * * *';

export async function startWorker(logger: Logger): Promise<{ stop: () => Promise<void> }> {
  // Application context tối giản — không HTTP listener.
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const outbox = app.get(OutboxService);
  const pendingSweep = app.get(PendingSweepService);

  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
  });
  boss.on('error', (err) => logger.error(`pg-boss error: ${err.message}`, err.stack));
  await boss.start();

  // Outbox drain — mỗi phút. policy 'short': tick mới không xếp chồng khi
  // tick cũ còn queued.
  await boss.createQueue(OUTBOX_DRAIN_QUEUE, { policy: 'short' });
  await boss.work(OUTBOX_DRAIN_QUEUE, async () => {
    await outbox.drainOnce();
  });
  await boss.schedule(OUTBOX_DRAIN_QUEUE, OUTBOX_DRAIN_CRON);

  // Outbox retention — SENT > 30 ngày bị xóa; FAILED giữ cho triage.
  await boss.createQueue(OUTBOX_PURGE_QUEUE, { policy: 'short' });
  await boss.work(OUTBOX_PURGE_QUEUE, async () => {
    await outbox.purgeSent(RETENTION_DAYS);
  });
  await boss.schedule(OUTBOX_PURGE_QUEUE, OUTBOX_PURGE_CRON);

  // Booking sweep — WRK-1: hủy PENDING bỏ hoang quá TTL (backstop webhook expired).
  await boss.createQueue(BOOKING_SWEEP_QUEUE, { policy: 'short' });
  await boss.work(BOOKING_SWEEP_QUEUE, async () => {
    await pendingSweep.sweepAbandoned(PENDING_TTL_MINUTES);
  });
  await boss.schedule(BOOKING_SWEEP_QUEUE, BOOKING_SWEEP_CRON);

  // Dọn ảnh mồ côi trên Cloudinary (ADR-0035).
  //
  // ⚠️ Queue chỉ được ĐĂNG KÝ khi có cờ, chứ không phải đăng ký rồi bên trong
  // return sớm — và khác biệt ấy là chủ đích, không phải văn phong. Dev và
  // prod dùng CHUNG một Cloudinary cloud, nên một worker chạy trên máy dev mà
  // lỡ có cờ sẽ destroy ảnh của site đang sống. Không tồn tại thì không có gì
  // để lỡ bật nhầm, và `boss.schedule` cũng không ghi một lịch nào vào schema
  // pgboss của DB dùng chung (ADR-0035 §6).
  if (env.MEDIA_GC_ENABLED) {
    const mediaGarbage = app.get(MediaGarbageService);
    // `retryLimit: 0` + `expireInSeconds` tường minh: một lượt sweep chậm
    // (Cloudinary rate-limit) vượt 15 phút mặc định sẽ bị pg-boss coi là hết
    // hạn và RETRY trong khi lượt cũ còn chạy — hai sweep chồng lên cùng tập
    // row. Lượt kế theo cron là đủ; không cần retry. `policy: 'short'` chỉ
    // chặn xếp chồng lúc gửi, không chặn retry sau expire (vòng vá review 05/09).
    await boss.createQueue(MEDIA_GC_QUEUE, {
      policy: 'short',
      retryLimit: 0,
      expireInSeconds: 3600,
    });
    await boss.work(MEDIA_GC_QUEUE, async () => {
      await mediaGarbage.sweep(new Date(), env.MEDIA_GC_GRACE_DAYS);
    });
    await boss.schedule(MEDIA_GC_QUEUE, MEDIA_GC_CRON);
  }

  logger.log(
    `worker loops started (${env.NODE_ENV}) — outbox-drain ${OUTBOX_DRAIN_CRON} · outbox-purge ${OUTBOX_PURGE_CRON} · booking-sweep ${BOOKING_SWEEP_CRON}` +
      (env.MEDIA_GC_ENABLED
        ? ` · media-gc ${MEDIA_GC_CRON} (chờ ${env.MEDIA_GC_GRACE_DAYS} ngày)`
        : ' · media-gc TẮT'),
  );

  let stopped = false;
  return {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await boss.stop({ graceful: true, timeout: 10_000 });
      await app.close();
      logger.log('worker loops stopped');
    },
  };
}
