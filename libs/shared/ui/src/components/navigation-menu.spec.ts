import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Spec này ĐỌC SOURCE của chính component thay vì render nó, và đó là lựa chọn có lý
 * do đo được: vitest của package này chạy env `node` (không jsdom), và thứ cần canh —
 * *một prop có được forward xuống Positioner hay không* — **không hiện ra DOM**. Base
 * UI dùng `sideOffset` để tính `top` qua floating-ui; trong jsdom mọi rect đều 0 nên
 * `top` ra 0 bất kể offset là 8 hay 34, tức phép render không phân biệt được.
 *
 * Vì sao phải canh: mutation-test 30/07 cho thấy nếu gỡ `sideOffset={sideOffset}` ở
 * `NavigationMenu` thì **6/6 test ở `destinations-menu.spec.tsx` vẫn xanh**, `pnpm
 * lint` im (Biome không coi prop destructure-mà-không-dùng là unused) và `pnpm
 * typecheck` cũng im. Nghĩa là bug quay lại hoàn toàn âm thầm — đúng loại hồi quy chỉ
 * có test này bắt được.
 *
 * Cách này có tiền lệ trong repo: `apps/web/src/lib/motion.spec.ts` và
 * `region-theme.spec.ts` đều đọc source cho các bất biến dạng "phải có / không được
 * có" mà phép render không nói được.
 */
function source(): string {
  return readFileSync(fileURLToPath(new URL('./navigation-menu.tsx', import.meta.url)), 'utf8');
}

/** Source đã bỏ comment — comment của repo giải thích chính những pattern bị cấm
    (kể cả bằng cách gõ nguyên văn `z-50` để nói vì sao không dùng), nên khớp regex
    trên source thô sẽ bắt được prose và báo đỏ oan. */
function code(): string {
  return source()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('NavigationMenu — hợp đồng định vị và xếp lớp', () => {
  // Chính mutation M3. Khoảng cách đúng phụ thuộc thanh CHỨA trigger, thứ chỉ chỗ gọi
  // biết (`destinations-menu.tsx` truyền 34 = 26 đệm navbar + 8 khe), nên Root PHẢI
  // chuyển tiếp. Gỡ dòng này là dropdown âm thầm về offset 8 và chui vào navbar 18px.
  it('Root forward `sideOffset` xuống Positioner — chỗ gọi mới biết thanh chứa trigger cao bao nhiêu', () => {
    expect(code()).toMatch(/<NavigationMenuPositioner[^>]*\bsideOffset=\{sideOffset\}/);
  });

  it('`sideOffset` có trong kiểu prop của Root, không chỉ được truyền lén', () => {
    expect(code()).toMatch(/Pick<\s*NavigationMenuPrimitive\.Positioner\.Props,[^>]*'sideOffset'/);
  });

  // Popup portal ra `body` nên stacking context của nó là ANH EM của `<nav>` trong
  // context gốc, và navbar là `z-(--z-sticky)`=1100. `z-50` của bản vendor thua 1100 →
  // navbar đè dropdown (đo 30/07 bằng `elementFromPoint`). Cùng lỗi đã sửa ở
  // `select.tsx`, `dialog.tsx`, `sheet.tsx`, `drawer.tsx`.
  it('Positioner và Popup dùng thang z token, KHÔNG còn `z-50` của bản vendor', () => {
    const c = code();
    expect(c).not.toMatch(/(^|[\s'"])z-50([\s'"]|$)/);
    // Hai chỗ: Positioner (tạo stacking context) và Popup (bề mặt vẽ).
    expect(c.match(/z-\(--z-popover\)/g) ?? []).toHaveLength(2);
  });

  // `destinations-menu.spec.tsx` đọc hai móc này để canh z-index từ phía app.
  it('giữ `data-slot` cho Positioner và Popup — spec phía app đọc chúng', () => {
    const c = code();
    expect(c).toContain('data-slot="navigation-menu-positioner"');
    expect(c).toContain('data-slot="navigation-menu-popup"');
  });

  // Cầu hover vô hình bắc qua khe giữa trigger và panel. Với `sideOffset` 34 thì khe
  // là 8px, nằm trong 10px của cầu — gỡ cầu là chuột đi xuống panel làm menu đóng
  // giữa đường. Đo 30/07: sau khi vá, chuột đi từ trigger qua khe xuống panel thì
  // menu VẪN mở.
  it('giữ cầu hover 10px phía trên panel — thiếu nó thì menu đóng giữa đường', () => {
    expect(code()).toContain('data-[side=bottom]:before:top-[-10px]');
  });
});
