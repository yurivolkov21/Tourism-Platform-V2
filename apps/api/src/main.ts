import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { configureHttp } from './bootstrap.js';
import { env } from './config/env.js';

async function bootstrap() {
  // rawBody (W2): Fastify adapter cất nguyên bytes request chưa đụng vào
  // `req.rawBody` (Buffer) cho body JSON — verify signature webhook BẮT BUỘC
  // thấy raw bytes (JSON re-serialize sẽ phá HMAC của Stripe/PayPal).
  //
  // trustProxy: deploy nằm sau reverse proxy của nền tảng (Render/Railway).
  // Không bật thì `req.ip` là IP của proxy — MỌI client dùng chung một địa
  // chỉ, nên rate limit theo IP sẽ khoá sạch cả site sau vài request của một
  // người. Phải có TRƯỚC khi gắn throttle, không phải sau.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { rawBody: true },
  );

  // CORS — tách sang bootstrap.ts để test e2e dùng lại được cùng cấu hình.
  await configureHttp(app);

  app.enableShutdownHooks();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`@tourism/api listening on :${env.PORT} (${env.NODE_ENV})`);
}

await bootstrap();
