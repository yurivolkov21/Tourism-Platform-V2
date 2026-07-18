import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap() {
  // rawBody (W2): the Fastify adapter stashes the untouched request bytes on
  // `req.rawBody` (Buffer) for JSON bodies — webhook signature verification
  // MUST see the raw bytes (re-serialized JSON breaks Stripe/PayPal HMACs).
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    rawBody: true,
  });
  app.enableShutdownHooks();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`@tourism/api listening on :${env.PORT} (${env.NODE_ENV})`);
}

await bootstrap();
