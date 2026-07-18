import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PgBoss } from 'pg-boss';
import { env } from './config/env.js';
import { OutboxService } from './worker/outbox.service.js';
import { WorkerModule } from './worker/worker.module.js';

/**
 * Worker entrypoint (spec §7) — process RIÊNG, cùng codebase với API.
 * pg-boss v12 (ESM native) chạy trên connection direct/session của chính nó
 * (schema `pgboss` tự quản, tách khỏi schema Prisma); LISTEN/maintenance
 * không sống nổi sau transaction pooler — cấm pooler (CLAUDE.md).
 */

const OUTBOX_DRAIN_QUEUE = 'outbox-drain';
/** Mỗi phút — granularity nhỏ nhất của cron pg-boss. */
const OUTBOX_DRAIN_CRON = '* * * * *';

const OUTBOX_PURGE_QUEUE = 'outbox-purge';
/** Hằng ngày 03:00 UTC (off-peak) — retention audit M5. */
const OUTBOX_PURGE_CRON = '0 3 * * *';
const RETENTION_DAYS = 30;

const logger = new Logger('Worker');

async function bootstrap(): Promise<void> {
  // Application context tối giản — không HTTP listener.
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const outbox = app.get(OutboxService);

  const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss' });
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

  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    logger.log(`${signal} received — stopping pg-boss…`);
    void (async () => {
      try {
        await boss.stop({ graceful: true, timeout: 10_000 });
        await app.close();
        logger.log('Worker shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error(`Shutdown error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    })();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log(
    `@tourism/api worker started (${env.NODE_ENV}) — outbox-drain ${OUTBOX_DRAIN_CRON} · outbox-purge ${OUTBOX_PURGE_CRON}`,
  );
}

await bootstrap();
