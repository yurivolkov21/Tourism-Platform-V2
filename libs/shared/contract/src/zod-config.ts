import { z } from 'zod';

/**
 * PHẢI là import ĐẦU TIÊN của `index.ts` (ADR-0038 AMEND 1 §e): zod 4 tính
 * `fastEnabled = !jitless && allowsEval` ngay lúc DỰNG `z.object`, và
 * `allowsEval` là phép thử `Function("")` — dưới CSP production không
 * `'unsafe-eval'` nó ném và browser ghi một vi phạm `script-src` ở mọi trang.
 * ES module hoist import: mọi `export * from './schemas/…'` chạy TRƯỚC thân
 * `index.ts`, nên đặt `z.config` trong thân index là quá muộn (đo lại trên
 * admin `next start` 07/09: vẫn 1 vi phạm). Module này đứng đầu danh sách
 * import để cấu hình chạy trước bất kỳ schema nào được dựng.
 */
z.config({ jitless: true });
