import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Ba primitive lớp nổi CHƯA app nào dùng nhưng còn `z-50` của bản vendor — bẫy chờ sẵn: dùng
 * chúng trong Dialog/Sheet (1300/1400) hay dưới navbar web (1100) là chìm, cùng lớp lỗi đã vá ở
 * popover/tooltip/select/menu (review AL2). Đọc source như `popover.spec.ts` vì env `node`
 * không render ra z-index; số chỗ là số phần tử đang mang z (combobox chỉ có Positioner).
 */
function code(file: string): string {
  return readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('primitive lớp nổi — hợp đồng xếp lớp', () => {
  it.each([
    ['hover-card.tsx', 2],
    ['context-menu.tsx', 2],
    ['combobox.tsx', 1],
  ])('%s dùng tầng `--z-popover`, không còn `z-50`', (file, count) => {
    const c = code(file);
    expect(c).not.toMatch(/(^|[\s'"])z-50([\s'"]|$)/);
    expect(c.match(/z-\(--z-popover\)/g) ?? []).toHaveLength(count);
  });
});
