import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration config — chạy `src/**\/*.int.spec.ts` trên Docker Postgres với
 * DB RIÊNG `tourism_test` (KHÔNG BAO GIỜ trỏ vào db dev `tourism` đã seed).
 * globalSetup tạo db (idempotent) + `prisma migrate deploy`.
 * `test.env` được set trước khi worker import app code → `env.ts` (đọc
 * process.env lúc import) nhìn thấy đúng giá trị test.
 */
export const TEST_DATABASE_URL = 'postgresql://tourism:tourism@localhost:5432/tourism_test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.int.spec.ts'],
    globalSetup: ['./vitest.int.global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: 'int-test-secret',
      BETTER_AUTH_URL: 'http://localhost:3001',
      ADMIN_EMAILS: 'bootstrap-admin@tourism.test',
    },
    // Một DB test dùng chung + truncate giữa các test → tuần tự hoá.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  oxc: false,
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
});
