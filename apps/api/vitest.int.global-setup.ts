import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './vitest.int.config.js';

/**
 * globalSetup cho integration tests: tạo db `tourism_test` trong container
 * compose (idempotent — "already exists" là OK) rồi áp migrations.
 * Chạy ở main process của Vitest, cwd = apps/api.
 */
export default function setup(): void {
  try {
    execSync(
      `docker exec tourism-v2-postgres-1 psql -U tourism -d postgres -c 'CREATE DATABASE tourism_test'`,
      { stdio: 'pipe' },
    );
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? String(error);
    if (!stderr.includes('already exists')) {
      throw new Error(`Failed to create tourism_test database: ${stderr}`);
    }
  }

  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
