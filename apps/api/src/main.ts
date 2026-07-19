import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap() {
  // rawBody (W2): Fastify adapter cất nguyên bytes request chưa đụng vào
  // `req.rawBody` (Buffer) cho body JSON — verify signature webhook BẮT BUỘC
  // thấy raw bytes (JSON re-serialize sẽ phá HMAC của Stripe/PayPal).
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    rawBody: true,
  });
  app.enableShutdownHooks();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`@tourism/api listening on :${env.PORT} (${env.NODE_ENV})`);
}

await bootstrap();
