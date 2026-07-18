import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.enableShutdownHooks();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`@tourism/api listening on :${env.PORT} (${env.NODE_ENV})`);
}

await bootstrap();
