import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { startWorker } from './worker/start-worker.js';

/**
 * Worker entrypoint (spec §7) — process RIÊNG, cùng codebase với API.
 * pg-boss v12 (ESM native) chạy trên connection direct/session của chính nó
 * (schema `pgboss` tự quản, tách khỏi schema Prisma); LISTEN/maintenance
 * không sống nổi sau transaction pooler — cấm pooler (CLAUDE.md).
 *
 * Ruột vòng worker sống ở `worker/start-worker.ts` (tách cho deploy v1,
 * ADR-0024) — entrypoint này chỉ còn signal-handling; chế độ INLINE
 * (`WORKER_INLINE=true`) dùng chung startWorker từ main.ts và dựa vào
 * shutdown hook của Nest thay vì SIGTERM tự bắt ở đây.
 */
const logger = new Logger('Worker');

const { stop } = await startWorker(logger);

let stopping = false;
const shutdown = (signal: string): void => {
  if (stopping) return;
  stopping = true;
  logger.log(`${signal} received — stopping pg-boss…`);
  void (async () => {
    try {
      await stop();
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
