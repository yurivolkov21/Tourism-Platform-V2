// Chép worker của maplibre-gl vào `public/maplibre/`.
//
// Vì sao phải chép TAY thay vì để bundler lo: từ maplibre 6, worker không còn
// được nhúng inline qua `blob:` nữa mà nạp từ một URL thật, và worker đó
// `import` file anh em `maplibre-gl-shared.mjs` bằng đường dẫn TƯƠNG ĐỐI. Tài
// liệu maplibre nói thẳng về Next.js: Turbopack biến
// `new URL('…/maplibre-gl-worker.mjs', import.meta.url)` thành một asset băm mà
// KHÔNG phát ra file `maplibre-gl-shared.mjs` nằm cạnh — worker chết ngay lần
// import đầu, và hậu quả nguyên văn là *"the map mounts but never requests a
// tile"*. Tức bản đồ TRẮNG IM LẶNG: không exception, build xanh, `pnpm gate`
// xanh (jsdom không có WebGL nên spec luôn mock `./contact-map`). Chỉ trình
// duyệt thật mới thấy. Đó là lý do bước này là SCRIPT chạy được chứ không phải
// một dòng dặn dò trong doc — cùng tinh thần `guard-build.mjs`.
//
// Hai file PHẢI nằm cùng một thư mục. Đừng đổi đuôi `.mjs` thành `.js`: worker
// import file anh em bằng đúng chuỗi `./maplibre-gl-shared.mjs`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// Giải qua `exports` map của gói (6.x có nhánh "./dist/*") thay vì ghép chuỗi
// `node_modules/...` — pnpm để gói trong store nên đường ghép tay sẽ sai.
const distDir = dirname(require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'));
const outDir = join(import.meta.dirname, '..', 'public', 'maplibre');

mkdirSync(outDir, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(distDir, file), join(outDir, file));
}
console.log(`✓ maplibre worker: đã chép 2 file vào ${outDir}`);
