import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Đọc source như `dropdown-menu.spec.ts` — vitest của package chạy env `node`, và z-index
 * không quan sát được qua render. `z-50` thấp hơn hộp thoại (`--z-modal` 1400) và navbar web
 * (`--z-sticky` 1100): popover đặt trong hộp thoại sẽ chìm (spec 2026-10-05 §2.4).
 */
function code(): string {
  return readFileSync(fileURLToPath(new URL('./tooltip.tsx', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('Tooltip — hợp đồng xếp lớp', () => {
  it('Positioner và Popup dùng thang z token, không còn `z-50`', () => {
    const c = code();
    // Mũi tên (`TooltipPrimitive.Arrow`) giữ `z-50` — nó nằm TRONG popup, xếp lớp cục bộ.
    expect(c.match(/z-\(--z-popover\)/g) ?? []).toHaveLength(2);
    expect(c).toMatch(/className="isolate z-\(--z-popover\)"/);
  });
});
