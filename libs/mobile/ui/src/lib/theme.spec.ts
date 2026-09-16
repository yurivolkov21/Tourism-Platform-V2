import { theme as tokens } from '@tourism/tokens/theme';
import {
  buildTheme,
  MOBILE_COLOR_KEYS,
  MOBILE_FONT_WEIGHTS,
  MOBILE_FONTS,
  MOBILE_TYPE_STEPS,
  withAlpha,
} from './theme';

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

  // Neo vào SỐ TUYỆT ĐỐI, không so với chính cầu token. So hai vế cùng đọc một
  // nguồn là tautology: ngày `--text-base` biến mất, cả hai vế đều `undefined`
  // và `expect(undefined).toEqual(undefined)` vẫn xanh trong khi app đã sai cỡ
  // chữ toàn bộ. Con số dưới đây là hợp đồng — đổi nó phải là một quyết định.
  it('type scale mang đúng số dp mà thiết kế đã chốt', () => {
    const t = buildTheme('light');

    expect(t.type.xs).toEqual({ fontSize: 12, lineHeight: 16 });
    expect(t.type.sm).toEqual({ fontSize: 14, lineHeight: 20 });
    expect(t.type.base).toEqual({ fontSize: 16, lineHeight: 24 });
    expect(t.type.lg).toEqual({ fontSize: 18, lineHeight: 28 });
    expect(t.type['2xl']).toEqual({ fontSize: 24, lineHeight: 32 });
    expect(t.type['3xl']).toEqual({ fontSize: 30, lineHeight: 36 });
  });

  it('font weight, bo góc, vùng chạm mang đúng giá trị đã chốt', () => {
    const t = buildTheme('light');

    expect(t.weight).toEqual({ normal: '400', medium: '500', semibold: '600', bold: '700' });
    expect(t.radius.base).toBe(6);
    expect(t.touchTargetMin).toBe(44);
    expect(t.spacing(1)).toBe(4);
  });

  it('mọi bậc và độ đậm đang khai đều thật sự có mặt', () => {
    const t = buildTheme('light');

    for (const step of MOBILE_TYPE_STEPS) {
      expect(t.type[step]).toBeDefined();
    }
    for (const key of MOBILE_FONT_WEIGHTS) {
      expect(t.weight[key]).toBeDefined();
    }
  });

  it('spacing(n) là bội số của bước gốc trong token', () => {
    const t = buildTheme('light');

    expect(t.spacing(1)).toBe(tokens.spacing);
    expect(t.spacing(4)).toBe(tokens.spacing * 4);
  });

  it('mọi font-weight từ cầu token là chuỗi số mà React Native nhận', () => {
    // `theme.weight` được thu hẹp về union `fontWeight` của RN bằng một phép
    // ép kiểu — test này là thứ canh cho phép ép đó không thành lời nói dối.
    for (const value of Object.values(buildTheme('light').weight)) {
      expect(value).toMatch(/^[1-9]00$/);
    }
  });

  // Ba cổng cùng một luật: đổi tên token trong `tokens.mjs` phải là một lỗi
  // NÉM NGAY nêu đúng tên khoá, không phải `undefined` trôi ra tận thiết bị.
  it('ném lỗi NÊU TÊN bậc chữ khi cầu token không còn bậc đang khai', () => {
    const type = { base: { fontSize: 16, lineHeight: 24 } };

    expect(() => buildTheme('light', { type })).toThrow(/"xs"/);
  });

  it('ném lỗi NÊU TÊN độ đậm khi cầu token không còn độ đậm đang khai', () => {
    const weight = { normal: '400' };

    expect(() => buildTheme('light', { weight })).toThrow(/"medium"/);
  });

  it('ném lỗi NÊU TÊN khoá khi cầu token không còn khoá màu đang khai', () => {
    const broken = { background: '#000000' };

    expect(() => buildTheme('light', { colors: { light: broken, dark: broken } })).toThrow(
      /foreground/,
    );
  });
});

describe('withAlpha', () => {
  it('gắn alpha vào hex 6 ký tự', () => {
    expect(withAlpha('#202a28', 0.5)).toBe('#202a2880');
  });

  it('thay alpha có sẵn của hex 8 ký tự — token `scrim` vốn đã mang alpha', () => {
    expect(withAlpha('#010a08cc', 0)).toBe('#010a0800');
  });

  it('kẹp alpha về khoảng 0–1 thay vì phát ra hex rác', () => {
    expect(withAlpha('#202a28', 2)).toBe('#202a28ff');
    expect(withAlpha('#202a28', -1)).toBe('#202a2800');
  });
});

describe('bốn khoá màu thêm cho cụm auth', () => {
  it.each(['destructive-emphasis', 'input', 'on-media', 'scrim'] as const)(
    'khoá "%s" có mặt ở cả hai chế độ và lấy đúng giá trị cầu token',
    (key) => {
      expect(buildTheme('light').colors[key]).toBe(tokens.colors.light[key]);
      expect(buildTheme('dark').colors[key]).toBe(tokens.colors.dark[key]);
    },
  );
});

describe('cầu font', () => {
  // Cầu token KHÔNG mang font family (ADR-0013 chỉ mang màu, bo góc, type
  // scale), nên tên khuôn chữ khai ở đây là hợp đồng — đổi nó phải là một
  // quyết định, không phải hệ quả của một lần gõ nhầm.
  it('phát ra family cho tiêu đề và cho từng độ đậm của chữ thân', () => {
    const { fonts } = buildTheme('dark');

    expect(fonts.heading).toBe('Literata_700Bold');
    expect(fonts.normal).toBe('Archivo_400Regular');
    expect(fonts.medium).toBe('Archivo_500Medium');
    expect(fonts.semibold).toBe('Archivo_600SemiBold');
    expect(fonts.bold).toBe('Archivo_700Bold');
  });

  it('mọi độ đậm đang khai đều có family, không bậc nào rơi về undefined', () => {
    const { fonts } = buildTheme('light');

    for (const weight of MOBILE_FONT_WEIGHTS) {
      expect(fonts[weight]).toBe(MOBILE_FONTS[weight]);
    }
  });
});
