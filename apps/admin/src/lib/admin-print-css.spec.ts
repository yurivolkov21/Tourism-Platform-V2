import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Hai luật CSS của admin mà tờ in báo cáo tháng (G40 Phần 2, ADR-0057) dựa vào — không test DOM nào
 * thấy được chúng (jsdom không nạp CSS), nên đọc thẳng `app/globals.css`.
 */
const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8')
  // Bỏ comment trước khi tách luật: comment có ngoặc nhọn và dấu phẩy.
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Các luật cấp một trong một khối: `[danh sách selector, thân]`. */
function rulesIn(block: string): [string[], string][] {
  const rules: [string[], string][] = [];
  let depth = 0;
  let start = 0;
  let selector = '';
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (ch === ';' && depth === 0) {
      // Câu lệnh at-rule không có thân (`@import`, `@source`) — không phải đầu một selector.
      start = i + 1;
    } else if (ch === '{') {
      if (depth === 0) {
        selector = block.slice(start, i).trim();
        start = i + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        rules.push([selector.split(',').map((part) => part.trim()), block.slice(start, i)]);
        start = i + 1;
      }
    }
  }
  return rules;
}

const topLevel = rulesIn(css);

/**
 * Thân của MỌI khối media có `print` (`@media print`, `@media screen, print`, …), kể cả khối lồng
 * trong at-rule khác (`@layer`, `@supports`) — khối in thêm về sau ở đâu cũng phải qua luật canh.
 */
function printBlocksIn(rules: [string[], string][]): string[] {
  return rules.flatMap(([selectors, body]) => {
    const prelude = selectors.join(',');
    if (/^@media\b.*\bprint\b/.test(prelude)) return [body];
    return prelude.startsWith('@') ? printBlocksIn(rulesIn(body)) : [];
  });
}

/** Tiền tố khoanh khối in chung: chỉ áp khi trang KHÔNG có tài liệu in. */
const NO_PRINT_DOC = ':root:not(:has([data-print-doc]))';

describe('globals.css của admin — tờ in báo cáo', () => {
  it('khối @media print chung không chạm trang có tài liệu in (không tô đen chữ phụ, nét bảng của tờ)', () => {
    const rules = printBlocksIn(topLevel).flatMap(rulesIn);
    expect(rules.length).toBeGreaterThan(0);
    for (const [selectors] of rules) {
      // `@page` khai báo trang giấy, không chọn phần tử nào.
      if (selectors[0]?.startsWith('@page')) continue;
      for (const selector of selectors) {
        // Biến mực giấy đặt trên ĐÚNG `:root` — khai báo biến, tờ in đặt lại bằng `.light`. Selector
        // nào khác, kể cả bắt đầu bằng `:root`, phải mang tiền tố khoanh.
        if (selector === ':root') continue;
        expect(selector.startsWith(NO_PRINT_DOC)).toBe(true);
      }
    }
  });

  it('tờ in nhận bảng màu trung tính của admin, thắng `.light` mà DocPage gắn', () => {
    const surface = topLevel.find(([selectors]) => selectors.includes('[data-admin-surface]'));
    expect(surface?.[0]).toContain('[data-admin-surface] [data-print-doc]');
    expect(surface?.[1]).toContain('--muted-foreground:');
  });
});
