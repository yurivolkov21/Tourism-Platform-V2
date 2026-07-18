import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 config. The schema-level `url` is gone in Prisma 7 — the CLI
 * (migrate/studio) reads the datasource url here; the runtime `PrismaClient`
 * gets its connection via the PrismaPg driver adapter instead.
 *
 * DATABASE_URL: direct/session connection ONLY (pool ~10) — transaction
 * poolers are banned in this repo (see CLAUDE.md). Local dev default matches
 * `compose.yaml`'s postgres service.
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
