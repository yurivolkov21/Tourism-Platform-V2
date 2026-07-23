import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit test cho apps/web (mock data, helper thuần) — không cần jsdom.
// Alias khớp tsconfig paths vì Vitest không tự đọc "paths".
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tourism/ui': fileURLToPath(new URL('../../libs/shared/ui/src', import.meta.url)),
    },
  },
  esbuild: {
    // File .tsx dùng JSX runtime tự động của React 19.
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
  },
});
