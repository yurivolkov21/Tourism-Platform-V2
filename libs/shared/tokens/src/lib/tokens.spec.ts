import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { oklch } from 'culori';
import { describe, expect, it } from 'vitest';
// Namespace import có chủ đích: cần cả default (tokens) lẫn named export regionDefaults.
import * as src from '../../style-dictionary/tokens.mjs';

// Bất biến của hệ màu Wuling (ADR-0013) — chặn regression khi chỉnh token.
const tokens = src.default;

describe('nguồn token màu', () => {
  it('mọi token màu có value + darkValue parse được (oklch hợp lệ)', () => {
    for (const [name, t] of Object.entries(tokens.color)) {
      expect(oklch(t.value), `${name}.value`).toBeDefined();
      expect(oklch(t.darkValue), `${name}.darkValue`).toBeDefined();
    }
  });

  it('primary light thuộc họ ngọc Wuling: hue ∈ [170,195], chroma ≤ 0.09', () => {
    // Ép kiểu vì overload của @types/culori trả `never` khi input là any (nguồn .mjs không type).
    const p = oklch(tokens.color.primary.value) as { h?: number; c?: number } | undefined;
    expect(p?.h).toBeGreaterThanOrEqual(170);
    expect(p?.h).toBeLessThanOrEqual(195);
    expect(p?.c).toBeLessThanOrEqual(0.09);
  });
});

// Thang z-index (`rootExtras`, chỉ đọc qua var()). Hộp xác nhận `AlertDialog` mở CHỒNG lên
// Dialog/Sheet đang mở (hộp "Discard changes?" khi bấm link trong Sheet sidebar admin ở màn
// hẹp — review AL2), nên tầng của nó phải trên `--z-modal`; nhưng Select/Tooltip/Menu mở BÊN
// TRONG hộp vẫn phải nổi trên nó, nên dưới `--z-popover`.
describe('thang z-index', () => {
  // Nguồn `.mjs` không có kiểu nên mỗi cặp ra `string[]` — tra theo phần tử đầu, thiếu thì NaN.
  const z = (name: string) => Number(src.rootExtras.find(([key]) => key === name)?.[1]);

  it('--z-alert nằm giữa --z-modal và --z-popover', () => {
    expect(z('--z-alert')).toBeGreaterThan(z('--z-modal'));
    expect(z('--z-alert')).toBeLessThan(z('--z-popover'));
  });
});

// ADR-0015 (Task 5i): ba khối override `[data-region='north'|'central'|'south']`
// đã XOÁ khỏi tokens.mjs — Task 5h chuyển hết consumer thật (component có tổ
// tiên `[data-region]`) sang token brand, nên lớp tint theo vùng không còn ai
// đọc. Các bất biến CŨ của describe này ("mỗi vùng đủ 6 slot", "ba hero cùng
// bậc tối", "ba hero khác nhau") nói về `src.regions` — nguồn đó không còn tồn
// tại, đã xoá cùng test. Test "REGIONS (TS) khớp key của regions" cũng xoá theo
// vì lý do y hệt: nó so khớp với `src.regions`, không còn gì để so.
describe('regionDefaults (:root — bảng màu phụ cho 4 consumer nhóm hai)', () => {
  const SLOTS = ['primary', 'deep', 'surface', 'spark', 'on-surface', 'hero'];

  it('đủ 6 slot, mọi giá trị parse được bằng oklch của culori', () => {
    expect(Object.keys(src.regionDefaults).sort()).toEqual([...SLOTS].sort());
    for (const [slot, v] of Object.entries(src.regionDefaults)) {
      expect(oklch(v), slot).toBeDefined();
    }
  });

  it('generated/tokens.css không còn khối [data-region] nào', async () => {
    // Tự build lại trong test thay vì đọc file có sẵn: task `test` của package
    // này chỉ dependsOn `^build` (build NGƯỢC DÒNG) trong turbo.json, không có
    // cạnh `build` của CHÍNH package — nên khi `pnpm gate` chạy
    // `turbo run build typecheck test` cùng lệnh, thứ tự build → test của
    // @tourism/tokens KHÔNG được đảm bảo (đo bằng skill turborepo — hai task
    // không nối dependsOn thì chạy song song). Import trực tiếp build.mjs để
    // tự tái tạo artifact mới nhất ngay tại đây, không phụ thuộc file có sẵn
    // (có thể cũ hoặc chưa từng được build).
    await import('../../style-dictionary/build.mjs');
    const cssPath = fileURLToPath(new URL('../../generated/tokens.css', import.meta.url));
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).not.toContain('[data-region');
  });
});

// G40 (ADR-0057 §5): màu của tài liệu in. Giấy luôn sáng nên bốn token có dark = light, và bản
// build sinh phạm vi `.light` để tài liệu in dưới <html class="dark"> lấy lại màu sáng.
describe('token của tài liệu in (G40)', () => {
  it('đủ bốn token, dark = light', () => {
    // `as const`: `tokens.mjs` có kiểu suy ra qua `allowJs`, không index được bằng `string` trần.
    for (const name of ['chart-gain', 'chart-cost', 'pending', 'pending-soft'] as const) {
      const token = tokens.color[name];
      expect(token, name).toBeDefined();
      expect(token.darkValue, name).toBe(token.value);
    }
  });

  it('generated/tokens.css có khối .light sau .dark, mang giá trị SÁNG của mọi màu', async () => {
    await import('../../style-dictionary/build.mjs');
    const cssPath = fileURLToPath(new URL('../../generated/tokens.css', import.meta.url));
    const css = readFileSync(cssPath, 'utf-8');
    const start = css.indexOf('.light {');
    expect(start).toBeGreaterThan(css.indexOf('.dark {'));
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toContain(`--background: ${tokens.color.background.value};`);
    expect(block).toContain(`--paper: ${tokens.color.paper.value};`);
    expect(block).toContain(`--pending: ${tokens.color.pending.value};`);
    expect(block).not.toContain(tokens.color.background.darkValue);
  });
});
