import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Hai project, MỘT runner (ADR-0014, cùng nếp apps/web): logic thuần chạy
// `node`, test component chạy `jsdom`. Alias khớp tsconfig paths vì Vitest
// không tự đọc "paths".
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Trần 5s mặc định là QUÁ SÁT cho test DOM có tương tác. `pnpm gate` chạy
    // `turbo run build typecheck test` trong MỘT đồ thị (concurrency mặc định
    // 10), nên vitest jsdom chen chỗ với `next build` của chính package mình và
    // của 4 package khác — đo 09/09: test chậm nhất lúc máy rảnh 1115ms, dưới
    // tải gate 3096ms, tức chỉ còn 1,6x biên. Bốn lần đỏ trong một ngày ở ba
    // package là hệ quả số học, không phải xui.
    //
    // 30s = 27x cái chậm nhất lúc rảnh, ~10x cái chậm nhất đo được dưới tải.
    // Khác con số 60s của mobile (fbb945af) là CỐ Ý: ở đó đo được `renderRouter`
    // cold 9,2s, vitest không có chi phí tương đương.
    //
    // Đặt ở cấp GỐC là đủ cho cả hai project — cả hai đều khai `extends: true`
    // (Vitest 4.x mặc định `extends` là FALSE, chỉ từ 5.0 mới true, nên dòng đó
    // là load-bearing, đừng gỡ). Đã đo cả hai chiều.
    //
    // CÁI GIÁ, ghi thẳng: một test TREO THẬT nay ngốn 30s thay vì 5s. Phanh
    // chống treo không phải trần này mà là `timeout-minutes` ở cấp job trong
    // ci.yml (thêm cùng đợt) — trước đó job treo chạy tới mặc định 6 GIỜ.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          // `src/proxy.spec.ts`: glob riêng vì proxy.ts nằm ở gốc src/ —
          // cùng nếp apps/web (I-1).
          include: ['src/lib/**/*.spec.ts', 'src/proxy.spec.ts'],
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
