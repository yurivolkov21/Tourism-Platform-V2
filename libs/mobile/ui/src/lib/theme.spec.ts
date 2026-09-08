import { theme as tokens } from '@tourism/tokens/theme';
import { buildTheme, MOBILE_COLOR_KEYS } from './theme';

describe('buildTheme', () => {
  it('lấy màu ĐÚNG bằng giá trị trong cầu token, không phải bản chép tay', () => {
    const light = buildTheme('light');

    for (const key of MOBILE_COLOR_KEYS) {
      expect(light.colors[key]).toBe(tokens.colors.light[key]);
    }
  });

  it('đổi colorScheme thì đổi cả bảng màu', () => {
    const light = buildTheme('light');
    const dark = buildTheme('dark');

    expect(dark.scheme).toBe('dark');
    expect(dark.colors.background).toBe(tokens.colors.dark.background);
    expect(dark.colors.background).not.toBe(light.colors.background);
  });

  it('mang nguyên type scale, font weight và bo góc từ token sang', () => {
    const t = buildTheme('light');

    expect(t.type.base).toEqual(tokens.type.base);
    expect(t.weight.semibold).toBe(tokens.weight.semibold);
    expect(t.radius.base).toBe(tokens.radius.base);
    expect(t.touchTargetMin).toBe(tokens.touchTargetMin);
  });

  it('spacing(n) là bội số của bước gốc trong token', () => {
    const t = buildTheme('light');

    expect(t.spacing(1)).toBe(tokens.spacing);
    expect(t.spacing(4)).toBe(tokens.spacing * 4);
  });

  it('ném lỗi NÊU TÊN khoá khi cầu token không còn khoá màu đang khai', () => {
    const broken = { background: '#000000' };

    expect(() => buildTheme('light', { colors: { light: broken, dark: broken } })).toThrow(
      /foreground/,
    );
  });
});
