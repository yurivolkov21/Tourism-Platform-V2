import {
  lineHeightToDp,
  remToDp,
  toRnColor,
  toRnScale,
} from '../../style-dictionary/rn-convert.js';

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

describe('lineHeightToDp', () => {
  it('đọc dạng calc(A / B) của Tailwind — tử số CHÍNH LÀ line-height theo rem', () => {
    // '--text-sm--line-height': 'calc(1.25 / 0.875)' → 1.25rem → 20dp.
    expect(lineHeightToDp('calc(1.25 / 0.875)', 14)).toBe(20);
    expect(lineHeightToDp('calc(1.5 / 1)', 16)).toBe(24);
  });

  it('đọc dạng bội số trần (5xl trở lên) bằng cách nhân với fontSize', () => {
    expect(lineHeightToDp('1', 48)).toBe(48);
    expect(lineHeightToDp('1.25', 16)).toBe(20);
  });

  it('ném lỗi khi gặp dạng lạ', () => {
    expect(() => lineHeightToDp('normal', 16)).toThrow(/line-height/);
  });

  // Dạng `calc(A / B)` chỉ dịch đúng khi B là fontSize của CHÍNH bậc đó tính
  // theo rem: web nhân tỉ lệ ấy với fontSize thật, còn ở đây ta lấy thẳng tử
  // số. Đổi `--text-*` mà quên sửa `--line-height` ghép đôi là web và mobile
  // lệch nhau im lặng — nên mẫu số lệch phải NỔ, không được im.
  it('ném lỗi khi mẫu số của calc không khớp fontSize của bậc', () => {
    expect(() => lineHeightToDp('calc(1.5 / 1)', 18)).toThrow(/mẫu số 16dp.*18dp/s);
  });
});

describe('toRnScale', () => {
  const themeExtras = [
    ['--text-sm', '0.875rem'],
    ['--text-sm--line-height', 'calc(1.25 / 0.875)'],
    ['--text-5xl', '3rem'],
    ['--text-5xl--line-height', '1'],
    ['--font-weight-medium', '500'],
    ['--font-weight-bold', '700'],
    ['--spacing', '0.25rem'],
  ];
  const rootExtras = [['--touch-target-min', '44px']];

  it('gom type scale thành fontSize + lineHeight theo dp', () => {
    expect(toRnScale(themeExtras, rootExtras).type).toEqual({
      sm: { fontSize: 14, lineHeight: 20 },
      '5xl': { fontSize: 48, lineHeight: 48 },
    });
  });

  it('giữ font-weight ở dạng chuỗi mà RN nhận', () => {
    expect(toRnScale(themeExtras, rootExtras).weight).toEqual({ medium: '500', bold: '700' });
  });

  it('đưa spacing base và touch target tối thiểu sang dp', () => {
    const scale = toRnScale(themeExtras, rootExtras);
    expect(scale.spacing).toBe(4);
    expect(scale.touchTargetMin).toBe(44);
  });

  it('ném lỗi khi một bậc type thiếu line-height ghép đôi', () => {
    expect(() => toRnScale([['--text-lg', '1.125rem']], rootExtras)).toThrow(/--text-lg/);
  });
});
