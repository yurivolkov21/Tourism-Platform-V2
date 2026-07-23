import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit test cho apps/web (mock data, helper thuần) — không cần jsdom.
// Alias khớp tsconfig paths vì Vitest không tự đọc "paths".
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
