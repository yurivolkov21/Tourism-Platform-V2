import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Cấu hình Prisma 7. Prisma 7 bỏ `url` trong schema: CLI (migrate, studio) đọc
 * url của datasource ở đây, còn `PrismaClient` lúc chạy nối qua driver adapter
 * PrismaPg (trần pool của tiến trình API nằm ở `src/config/db-pool.ts`).
 *
 * DATABASE_URL: CHỈ kết nối direct hoặc session — repo cấm transaction pooler
 * (xem CLAUDE.md). File này chỉ đọc `.env` qua `dotenv/config`, KHÔNG đọc
 * `.env.local`; không có biến thì rơi về Postgres của `compose.yaml`.
 */
const LOCAL_COMPOSE_URL = 'postgresql://tourism:tourism@localhost:5432/tourism';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'pnpm run db:seed',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? LOCAL_COMPOSE_URL,
  },
});
