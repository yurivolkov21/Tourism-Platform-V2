import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Hai project, MỘT runner (ADR-0014): logic thuần chạy môi trường `node` cho
// nhanh, test component chạy `jsdom`. Alias khớp tsconfig paths vì Vitest
// không tự đọc "paths".
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          // src/proxy.spec.ts: thêm glob riêng (I-1) — proxy.ts nằm ở gốc
          // src/, không khớp glob thư mục con sẵn có.
          include: ['src/lib/**/*.spec.ts', 'src/mocks/**/*.spec.ts', 'src/proxy.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/components/**/*.spec.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
