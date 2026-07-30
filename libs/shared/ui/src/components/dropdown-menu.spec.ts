import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Cùng lý do đọc source như `navigation-menu.spec.ts`: vitest của package này chạy env
 * `node` (không jsdom), và cả hai thứ cần canh — một class z-index có mặt hay không, và
 * `sideOffset` có được forward hay không — **không phân biệt được qua phép render**
 * (jsdom không dựng layout nên `top` luôn ra 0 bất kể offset).
 *
 * `DropdownMenu` là consumer thứ hai của lớp lỗi "popup portal ra `body` nên stacking
 * context của nó là ANH EM của `<nav>` z-1100, và `z-50` của bản vendor thua". Vá cùng
 * đợt với `navigation-menu` ngày 30/07 vì `user-menu.tsx` render nó **trong chính
 * navbar đó** (`site-header.tsx:100`).
 *
 * Đo trước khi vá (Chromium, MOCK_SESSION tạm bật SAMPLE_USER, cả hai trạng thái cuộn):
 * `positioner z=50` · `popup.top − nav.bottom = **−16px**` · hit-test giữa vùng chồng
 * cho ra **NAV**. Avatar cao 32px trong hàng cao 40px nên đệm nav dưới nó là 20px, và
 * `sideOffset` mặc định 4 để lại −16.
 */
function code(): string {
  return readFileSync(fileURLToPath(new URL('./dropdown-menu.tsx', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('DropdownMenu — hợp đồng xếp lớp', () => {
  it('Positioner và Popup dùng thang z token, KHÔNG còn `z-50` của bản vendor', () => {
    const c = code();
    expect(c).not.toMatch(/(^|[\s'"])z-50([\s'"]|$)/);
    // Hai chỗ: Positioner (tạo stacking context) và Popup (bề mặt vẽ).
    expect(c.match(/z-\(--z-popover\)/g) ?? []).toHaveLength(2);
  });

  // Chỗ gọi mới biết thanh chứa trigger cao bao nhiêu — `user-menu.tsx` truyền 28.
  // `DropdownMenuContent` đã nhận `sideOffset` từ trước (khác `NavigationMenu`, ở đó
  // phải mở rộng Root), nên chỉ cần canh rằng nó vẫn forward xuống Positioner.
  it('forward `sideOffset` xuống Positioner — chỗ gọi mới biết dải chứa trigger', () => {
    expect(code()).toMatch(/<MenuPrimitive\.Positioner[\s\S]{0,400}?\bsideOffset=\{sideOffset\}/);
  });

  it('giữ `data-slot` cho Positioner và Popup — spec phía app đọc chúng', () => {
    const c = code();
    expect(c).toContain('data-slot="dropdown-menu-positioner"');
    expect(c).toContain('data-slot="dropdown-menu-content"');
  });
});
