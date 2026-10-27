import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Unit config — loại *.int.spec.ts (cần Docker PG; chạy bằng `pnpm test:int`
// với vitest.int.config.ts).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // `dist-seed/` là bản build của `db:seed`. Trên Windows `--ignore '**/*.spec.ts'` của swc
    // không loại được file spec (đo 27/10), nên thư mục này có `*.spec.js` đã biên dịch; không
    // loại thì Vitest gom cả chúng và đỏ hàng loạt "failed to read .swcrc".
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-seed/**', '**/*.int.spec.ts'],
  },
  oxc: false,
  // esbuild (mặc định của Vitest) không emit decorator metadata → NestJS DI hỏng.
  plugins: [
    swc.vite({
      // Bỏ qua `.mjs` (script node của `scripts/`): JS thuần, không cần biến đổi,
      // mà `.swcrc` chỉ có mục cho `.ts`/`.tsx` nên swc từ chối file `.mjs`
      // ("exists but not matched").
      exclude: /node_modules|\.mjs$/,
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
});
