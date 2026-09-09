#!/usr/bin/env node
// Canh luật tokens-only (CLAUDE.md #6, ADR-0040 §3) BẰNG MÁY, trên CẢ HAI thư
// mục mobile. Luật nào người hay quên thì để máy nhớ — cùng tiền lệ với
// `scripts/check-admin-prerender.mjs`.
//
// Vì sao là script chứ không phải spec trong một package: luật phủ cả
// `libs/mobile/ui` (primitive) LẪN `apps/mobile` (màn hình). Bản đầu chỉ quét
// `libs/mobile/ui/src/lib` — tức để trống đúng chỗ 51 màn của P5b sắp mọc lên,
// nơi rủi ro cao nhất. Một spec nằm trong package này không với sang package
// kia mà không tạo phụ thuộc ngược.
//
// Chạy tay: node scripts/check-mobile-tokens-only.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['libs/mobile/ui/src', 'apps/mobile/src'];

// Màu viết tay KHÔNG chỉ có dạng `#rrggbb`. Bản đầu chỉ bắt hex nên `rgba()`,
// `hsl()` và tên màu CSS đi qua tự do — `button.tsx` đã có sẵn một `'transparent'`
// chứng minh lỗ đó là thật.
const PATTERNS = [
  { name: 'hex', re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'rgb/hsl', re: /\b(?:rgba?|hsla?)\s*\(/ },
  { name: 'tên màu CSS', re: /['"](?:white|black|red|green|blue|gray|grey|silver)['"]/i },
];

// `transparent` là "không có màu", không phải một màu brand — nó không thể
// trôi lệch khỏi token nào. Cho phép, nhưng phải khai ở đây chứ không âm thầm.
const ALLOWED = /['"]transparent['"]/;

function sourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    // Spec được phép nhắc màu: nó ĐỐI CHIẾU với giá trị trong cầu token.
    if (/\.spec\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

const files = ROOTS.flatMap(sourceFiles);

// Cổng tự-kiểm. Không có nó thì `sourceFiles` trả `[]` (đổi cấu trúc thư mục,
// chạy sai cwd) là bộ quét duyệt qua con số không và báo XANH — đúng kiểu
// "lưới nói dối" mà chính luật này sinh ra để chặn.
if (files.length < 10) {
  console.error(
    `✗ chỉ tìm thấy ${files.length} file nguồn trong ${ROOTS.join(', ')} — ` +
      'bộ quét không đọc được thư mục, không phải là "sạch". Chạy từ gốc repo.',
  );
  process.exit(1);
}

const offenders = [];
for (const path of files) {
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (ALLOWED.test(line)) return;
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        offenders.push(`${relative(process.cwd(), path)}:${i + 1} [${name}] ${line.trim()}`);
        return;
      }
    }
  });
}

if (offenders.length > 0) {
  console.error('✗ màu viết tay trong code mobile — mọi màu phải qua `useTheme()`:');
  for (const line of offenders) console.error(`  ${line}`);
  process.exit(1);
}

console.log(`✓ tokens-only: ${files.length} file nguồn mobile, không màu viết tay nào`);
