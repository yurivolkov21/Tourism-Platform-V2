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
  it.each(['destructive-emphasis', 'input', 'on-media', 'primary-emphasis', 'scrim'] as const)(
    'khoá "%s" có mặt ở cả hai chế độ và lấy đúng giá trị cầu token',
    (key) => {
      expect(buildTheme('light').colors[key]).toBe(tokens.colors.light[key]);
      expect(buildTheme('dark').colors[key]).toBe(tokens.colors.dark[key]);
    },
  );
});

describe('năm khoá màu thêm cho cụm browse (P5b-2)', () => {
  it.each(['rating', 'rating-muted', 'price-compare', 'warning', 'overlay'] as const)(
    'khoá "%s" có mặt ở cả hai chế độ và lấy đúng giá trị cầu token',
    (key) => {
      expect(buildTheme('light').colors[key]).toBe(tokens.colors.light[key]);
      expect(buildTheme('dark').colors[key]).toBe(tokens.colors.dark[key]);
    },
  );
});

/** Độ chói tương đối WCAG của hex `#rrggbb`. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tỉ lệ tương phản WCAG giữa hai hex `#rrggbb`. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Màu `tint` phủ `alpha` lên `surface`, trộn trong sRGB như React Native vẽ. */
function tintOver(tint: string, alpha: number, surface: string): string {
  const mixed = [1, 3, 5].map((i) => {
    const top = Number.parseInt(tint.slice(i, i + 2), 16);
    const bottom = Number.parseInt(surface.slice(i, i + 2), 16);
    return Math.round(top * alpha + bottom * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  });
  return `#${mixed.join('')}`;
}

describe('hai khoá vai mực trạng thái (G47, ADR-0019 AMEND 4)', () => {
  it.each(['warning-emphasis', 'success-emphasis'] as const)(
    'khoá "%s" có mặt ở cả hai chế độ và lấy đúng giá trị cầu token',
    (key) => {
      expect(buildTheme('light').colors[key]).toBe(tokens.colors.light[key]);
      expect(buildTheme('dark').colors[key]).toBe(tokens.colors.dark[key]);
    },
  );

  // Đúng bốn tổ hợp app đang vẽ chữ trạng thái 12dp lên lớp tô nhạt của chính tông ấy: huy hiệu
  // "Almost full" (`tour-detail-screen.tsx`), nhãn "Paid" của Trips (`trips-screen.tsx`) và của
  // chi tiết đơn (`booking-detail-screen.tsx`), nhãn "Published" của My reviews (cùng 16% như chi
  // tiết đơn). Chữ nhỏ nên phải giữ 4.5:1 (WCAG 1.4.3). Chỗ sát nhất là Trips tối: 4.55 ở 18%.
  it.each([
    { ink: 'warning-emphasis', tint: 'warning', alpha: 0.2, surface: 'background' },
    { ink: 'success-emphasis', tint: 'success', alpha: 0.18, surface: 'card' },
    { ink: 'success-emphasis', tint: 'success', alpha: 0.16, surface: 'card' },
  ] as const)(
    '$ink trên $tint $alpha phủ $surface đạt 4.5:1 ở cả hai theme',
    ({ ink, tint, alpha, surface }) => {
      for (const scheme of ['light', 'dark'] as const) {
        const { colors } = buildTheme(scheme);
        const pill = tintOver(colors[tint], alpha, colors[surface]);
        expect(contrast(colors[ink], pill)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('mực bề mặt trần thì trượt ở theme sáng — lý do phải có hai khoá trên', () => {
    const { colors } = buildTheme('light');

    expect(contrast(colors.warning, tintOver(colors.warning, 0.2, colors.background))).toBeLessThan(
      4.5,
    );
    expect(contrast(colors.success, tintOver(colors.success, 0.16, colors.card))).toBeLessThan(4.5);
  });
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
