import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Đọc source như `popover.spec.ts` — env `node` không dựng bố cục. ItemText là `flex-1 shrink-0`
 * nên ra `flex: 1 0 0%`, mà phần tử flex mặc định `min-width: auto` (bằng cả chữ, nowrap) thì
 * không bao giờ hẹp hơn nội dung: span `truncate` bên trong luôn đủ chỗ, tên dài không ra "…"
 * mà tràn ra mép popup, dấu tích đè chữ và chữ phụ "Hidden" bị cắt mất (review D2, đo Edge
 * headless trên CSS build thật). `min-w-0` cho ItemText co theo bề rộng mục.
 */
function code(): string {
  return readFileSync(fileURLToPath(new URL('./select.tsx', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('Select — mục trong danh sách', () => {
  it('ItemText co được dưới bề rộng chữ (`min-w-0`) để tên dài cắt "…"', () => {
    expect(code()).toMatch(/<SelectPrimitive\.ItemText className="[^"]*\bmin-w-0\b[^"]*"/);
  });
});
