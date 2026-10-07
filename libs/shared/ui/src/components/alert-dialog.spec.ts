import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Đọc source như `popover.spec.ts` — vitest của package chạy env `node`, và z-index không quan
 * sát được qua render. `z-50` của bản vendor thấp hơn mọi tầng token: ở admin màn hẹp, hộp
 * "Discard changes?" mở DƯỚI Sheet sidebar (1300/1400) nên focus kẹt trong hộp bị che; ở web,
 * navbar (`--z-sticky` 1100) nổi trên hộp "Cancel booking" (review AL2). Tầng riêng `--z-alert`
 * vì hộp xác nhận mở CHỒNG lên Dialog/Sheet, mà popover mở bên trong nó vẫn phải nổi trên.
 */
function code(): string {
  return readFileSync(fileURLToPath(new URL('./alert-dialog.tsx', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('AlertDialog — hợp đồng xếp lớp', () => {
  it('Backdrop và Popup dùng tầng token `--z-alert`, không còn `z-50`', () => {
    const c = code();
    expect(c).not.toMatch(/(^|[\s'"])z-50([\s'"]|$)/);
    expect(c.match(/z-\(--z-alert\)/g) ?? []).toHaveLength(2);
  });
});
