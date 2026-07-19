import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { TEST_DATABASE_URL } from './vitest.int.config.js';

/**
 * globalSetup cho integration tests: tạo db `tourism_test` (idempotent) rồi
 * áp migrations. Chạy ở main process của Vitest, cwd = apps/api.
 *
 * Kết nối THẲNG qua TCP tới db admin `postgres` bằng `pg` (dependency có sẵn
 * của @tourism/api) — CỐ Ý không dùng `docker exec <container> psql` như bản
 * cũ: cách đó chỉ chạy được khi có container Docker Compose cục bộ mang đúng
 * tên cố định (`tourism-v2-postgres-1`). CI (GitHub Actions job `services:`)
 * cũng expose Postgres qua cổng TCP giống hệt compose ở local (xem
 * `.github/workflows/ci.yml`) nhưng KHÔNG tạo container mang tên đó — dùng
 * TCP là cách DUY NHẤT chạy giống nhau ở cả hai môi trường.
 */
export default async function setup(): Promise<void> {
  // TEST_DATABASE_URL trỏ vào db `tourism_test` — db đích CHƯA TỒN TẠI ở lần
  // chạy đầu nên phải kết nối vào db admin mặc định `postgres` trước.
  const adminUrl = TEST_DATABASE_URL.replace(/\/tourism_test(\?|$)/, '/postgres$1');
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('CREATE DATABASE tourism_test');
  } catch (error) {
    // 42P04 = duplicate_database (SQLSTATE Postgres) — idempotent, bỏ qua.
    const pgError = error as { code?: string };
    if (pgError.code !== '42P04') throw error;
  } finally {
    await client.end();
  }

  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
