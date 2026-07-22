import { remToDp, toRnColor } from '../../style-dictionary/rn-convert.js';

describe('toRnColor', () => {
  it('converts pure black and white exactly', () => {
    expect(toRnColor('oklch(0 0 0)')).toBe('#000000');
    expect(toRnColor('oklch(1 0 0)')).toBe('#ffffff');
  });

  it('emits 8-digit hex when the color has alpha', () => {
    expect(toRnColor('oklch(0 0 0 / 0.5)')).toBe('#00000080');
    expect(toRnColor('oklch(1 0 0 / 10%)')).toMatch(/^#ffffff[0-9a-f]{2}$/);
  });

  // Đổi input theo brand Wuling (ADR-0013) — hành vi chuyển màu test không đổi.
  it('giữ primary ngọc Wuling green-dominant khi chuyển hex', () => {
    const hex = toRnColor('oklch(0.494 0.067 184.3)');
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    // Destructure với default 0: tsconfig v2 bật noUncheckedIndexedAccess (nghiêm hơn Nexora).
    const [r = 0, g = 0, b = 0] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((c) =>
      parseInt(c, 16),
    );
    expect(g).toBeGreaterThan(r);
    // Ngọc Wuling ngả teal: g nhỉnh hơn hoặc xấp xỉ b (không còn chênh lớn như emerald cũ).
    expect(g).toBeGreaterThanOrEqual(b);
  });

  it('throws on unparseable input', () => {
    expect(() => toRnColor('not-a-color')).toThrow(/unparseable/);
  });
});

describe('remToDp', () => {
  it('converts at the 16px root', () => {
    expect(remToDp('0.375rem')).toBe(6);
    expect(remToDp('1rem')).toBe(16);
  });

  it('throws on non-rem input', () => {
    expect(() => remToDp('12px')).toThrow(/expected rem/);
  });
});
