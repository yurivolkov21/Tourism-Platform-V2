import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit test logic thuần (cva) — không cần jsdom. Alias khớp tsconfig paths
// vì Vitest không tự đọc "paths" của tsconfig.
export default defineConfig({
  resolve: {
    alias: {
      '@tourism/ui': fileURLToPath(new URL('./src', import.meta.url)),
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
