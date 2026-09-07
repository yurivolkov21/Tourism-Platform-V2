#!/usr/bin/env node
/**
 * Lưới CI cho CSP nonce của admin (ADR-0038 AMEND 1): mọi HTML admin bị
 * prerender TĨNH là không có nonce → `script-src 'nonce-…' 'strict-dynamic'`
 * chặn trắng script ở production, dev không lộ. Đọc `prerender-manifest.json`
 * sau `next build`, đỏ nếu có route tĩnh ngoài allowlist. Bảng route Next in
 * ra sau build GIẤU `/_global-error` (build/utils.js) nên mắt người từng trượt
 * — đây là thứ duy nhất canh được cả lớp lỗi này.
 *
 * Chạy: node scripts/check-admin-prerender.mjs (sau `pnpm turbo run build`).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MANIFEST = path.resolve('apps/admin/.next/prerender-manifest.json');
// /robots.txt: file text, không script. /_global-error: 500.html tĩnh Next tự
// dựng, không ép động được — chấp nhận mất hydrate (chỉ chữ), ghi ở ADR.
const ALLOWED_STATIC = new Set(['/robots.txt', '/_global-error']);

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (error) {
  console.error(`check-admin-prerender: không đọc được ${MANIFEST} — build admin trước.`, error);
  process.exit(2);
}

const staticRoutes = Object.keys(manifest.routes ?? {});
const offenders = staticRoutes.filter((route) => !ALLOWED_STATIC.has(route));
if (offenders.length > 0) {
  console.error(
    `check-admin-prerender: route admin bị prerender TĨNH (không nonce → CSP chặn trắng script ở production): ${offenders.join(', ')}. Ép động bằng \`await connection()\` hoặc xét lại \`dynamic\` (ADR-0038 AMEND 1).`,
  );
  process.exit(1);
}
console.log(
  `check-admin-prerender: OK — route tĩnh chỉ có ${staticRoutes.join(', ') || '(không có)'}`,
);
