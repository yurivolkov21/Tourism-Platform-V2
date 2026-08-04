// Dựng mockup thiết kế thành MỘT file HTML tự chứa để đăng lên Artifact.
//
// CÁCH DÙNG
//   pnpm --filter @tourism/web build     # cần chạy TRƯỚC — xem "vì sao" bên dưới
//   node docs/design/mockups/build.mjs [tên-mockup]
//   → docs/design/mockups/dist/<tên>.html   (dist/ đã nằm trong .gitignore)
//
// Mặc định `tên-mockup` là `booking-flow`, tức nguồn `booking-flow.src.html`.
//
// VÌ SAO PHẢI CÓ BƯỚC BUILD WEB TRƯỚC: Artifact chạy dưới một CSP chặn MỌI host
// ngoài — không link được Google Fonts, không tải được file rời. Nên ba họ chữ
// thật (Literata · Archivo · IBM Plex Mono) và mask vân đồng mức phải nhúng
// thẳng vào HTML dạng data-URI. Chỗ DUY NHẤT trong repo có sẵn file woff2 đã
// subset đúng là cache của `next/font` ở `apps/web/.next/static/media`, và nó
// chỉ tồn tại sau khi build web.
//
// VÌ SAO KHÔNG HARDCODE TÊN FILE FONT: `next/font` băm tên theo nội dung, nên
// mỗi lần đổi font/cấu hình là tên đổi. Script này đọc các rule @font-face
// trong CSS đã build rồi TỰ TÌM đúng file theo họ chữ + kiểu + subset. Thiếu
// bất kỳ mảnh nào thì dừng TO TIẾNG, không lặng lẽ rơi về font hệ thống (mất
// heading serif là mất luôn bản sắc site, mà lỗi đó không hiện ra ở diff).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const WEB = join(ROOT, 'apps/web');
const CHUNKS = join(WEB, '.next/static/chunks');
const MEDIA = join(WEB, '.next/static/media');

const name = process.argv[2] ?? 'booking-flow';
const srcPath = join(HERE, `${name}.src.html`);

function die(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!existsSync(srcPath)) die(`Không thấy nguồn: ${srcPath}`);
if (!existsSync(CHUNKS) || !existsSync(MEDIA)) {
  die(
    'Chưa có cache next/font. Chạy `pnpm --filter @tourism/web build` trước rồi\n' +
      `  chạy lại script này (cần: ${CHUNKS}).`,
  );
}

// ── Đọc mọi @font-face trong CSS đã build ───────────────────────────────────
const css = readdirSync(CHUNKS)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(CHUNKS, f), 'utf8'))
  .join('\n');

const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)]
  .map((m) => {
    const body = m[1];
    const prop = (key) => (body.match(new RegExp(`${key}:([^;]*)`)) ?? [])[1];
    const range = prop('unicode-range') ?? '';
    return {
      family: prop('font-family'),
      style: prop('font-style'),
      weight: prop('font-weight'),
      file: (body.match(/url\(\.\.\/media\/([^)]*)\)/) ?? [])[1],
      // `U+??` là cách viết gọn của U+0000–U+00FF → subset latin cơ bản.
      // Dải U+1EA0–U+1EF9 là chữ Việt có dấu — thiếu nó thì Hạ Long, Huế,
      // Ninh Bình rơi về font hệ thống ngay giữa dòng.
      subset: range.startsWith('U+??') ? 'latin' : range.includes('U+1EA0-1EF9') ? 'viet' : null,
    };
  })
  .filter((f) => f.file && f.subset);

// LẤY TẤT CẢ face latin + viet của ba họ, KHÔNG liệt kê từng vai (họ × kiểu ×
// subset). Bản đầu có một danh sách cứng và nó thiếu đúng hai vai —
// `IBM Plex Mono viet` với `Literata italic viet` — nên ă/đ/ơ/ư trong ô mono và
// dòng nghiêng rơi ÂM THẦM về font hệ thống. Guard "không thấy thì chết" không
// cứu được: nó chỉ canh được thứ ĐÃ có trong danh sách, còn vai bị bỏ quên thì
// vô hình. Mockup 04/08 thoát nạn hoàn toàn nhờ may (Hạ Long · Huế · Hội An ·
// Hà Nội · Sài Gòn không có chữ nào trong 22 ký tự đó) — thêm "Đà Nẵng" hay
// "Phú Quốc" vào mã đợt là vỡ ngay. Lấy trọn thì lớp lỗi này biến mất.
const FAMILIES = ['Literata', 'Archivo', 'IBM Plex Mono'];
const picked = faces.filter((f) => FAMILIES.includes(f.family));

// Bất biến: MỖI họ phải mang được tiếng Việt. Thiếu là dừng, không im lặng
// xuống cấp — đó là toàn bộ lý do tồn tại của bước kiểm này.
for (const family of FAMILIES) {
  for (const subset of ['latin', 'viet']) {
    if (!picked.some((f) => f.family === family && f.subset === subset)) {
      die(`Không tìm thấy @font-face nào cho ${family} (subset ${subset}).`);
    }
  }
}

let bytes = 0;
const fontCss = picked
  .map(({ family, style, weight, file }) => {
    const buf = readFileSync(join(MEDIA, file));
    bytes += buf.length;
    return (
      `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};` +
      `font-display:swap;src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')}`
    );
  })
  .join('\n');

// ── Vân đồng mức: file SVG chỉ mang alpha, màu do CSS đặt nên tự ăn theo theme ──
const topoPath = join(WEB, 'public/images/topo-wide.svg');
if (!existsSync(topoPath)) die(`Không thấy mask vân đồng mức: ${topoPath}`);
const topo = `data:image/svg+xml;base64,${readFileSync(topoPath).toString('base64')}`;

// ── Ráp ─────────────────────────────────────────────────────────────────────
const src = readFileSync(srcPath, 'utf8');
if (!src.includes('/*__FONTS__*/')) die('Nguồn thiếu chỗ cắm `/*__FONTS__*/`.');
if (!src.includes('__TOPO__')) die('Nguồn thiếu chỗ cắm `__TOPO__`.');

const out = src.replace('/*__FONTS__*/', fontCss).replaceAll('__TOPO__', topo);

const outDir = join(HERE, 'dist');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${name}.html`);
writeFileSync(outPath, out);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`✓ ${outPath}`);
console.log(`  ${picked.length} file font (${kb(bytes)} thô) · tổng ${kb(out.length)}`);
