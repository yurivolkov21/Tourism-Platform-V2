import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { configureHttp, createFastifyAdapter } from './bootstrap.js';
import { env } from './config/env.js';
import { startWorker } from './worker/start-worker.js';

async function bootstrap() {
  // rawBody (W2): Fastify adapter cất nguyên bytes request chưa đụng vào
  // `req.rawBody` (Buffer) cho body JSON — verify signature webhook BẮT BUỘC
  // thấy raw bytes (JSON re-serialize sẽ phá HMAC của Stripe/PayPal).
  //
  // trustProxy: deploy nằm sau reverse proxy của nền tảng (Render/Railway).
  // Không bật thì `req.ip` là IP của proxy — MỌI client dùng chung một địa
  // chỉ, nên rate limit theo IP sẽ khoá sạch cả site sau vài request của một
  // người. Phải có TRƯỚC khi gắn throttle, không phải sau.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter(), {
    rawBody: true,
  });

  // CORS — tách sang bootstrap.ts để test e2e dùng lại được cùng cấu hình.
  await configureHttp(app);

  app.enableShutdownHooks();

  // WORKER_INLINE (deploy v1, ADR-0024): Render free không có Background
  // Worker → vòng worker (pg-boss) chạy TRONG tiến trình API. Hai ràng buộc
  // ngược chiều, đều đo được: hook `onClose` phải đăng ký TRƯỚC listen
  // (Fastify ném FST_ERR_INSTANCE_ALREADY_LISTENING nếu thêm sau), còn worker
  // phải khởi động SAU listen để health check của nền tảng thấy cổng mở ngay.
  // Giải bằng ref: hook đóng qua `stopWorker` gán muộn. Dừng đi qua chuỗi
  // `app.close()` của Nest (shutdown hook → adapter đóng → onClose ĐƯỢC AWAIT)
  // — bắt SIGTERM tay thì đua với Nest và thua, tiến trình thoát trước khi
  // pg-boss stop graceful xong.
  let stopWorker: (() => Promise<void>) | null = null;
  if (env.WORKER_INLINE) {
    app
      .getHttpAdapter()
      .getInstance()
      .addHook('onClose', async () => {
        await stopWorker?.();
      });
  }

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  if (env.WORKER_INLINE) {
    stopWorker = (await startWorker(new Logger('WorkerInline'))).stop;
  }

  console.log(
    `@tourism/api listening on :${env.PORT} (${env.NODE_ENV})${env.WORKER_INLINE ? ' + inline worker' : ''}`,
  );
}

await bootstrap();
