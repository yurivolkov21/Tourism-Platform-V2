import { type RnTheme, theme as tokens } from '@tourism/tokens/theme';
import type { TextStyle } from 'react-native';

/**
 * Cầu token → giá trị React Native. Đây là chỗ DUY NHẤT trong `@tourism/mobile-ui`
 * chạm vào `@tourism/tokens/theme` (ADR-0040 §3): component lấy qua `useTheme()`,
 * không import token trực tiếp, và không viết hex nào bằng tay.
 */

/** Hai chế độ màu mà `useColorScheme()` của React Native trả về. */
export type ColorScheme = 'light' | 'dark';

/**
 * Những khoá màu mà bộ primitive hiện tại thật sự dùng — ĐÚNG bằng số đang
 * dùng, không thêm khoá "để dành". Cố ý là danh sách CURATED chứ không phải cả
 * bảng token: nó biến "token bị đổi tên" từ một lỗi chạy mới biết thành một
 * lỗi ném ngay lúc dựng theme, và bắt người thêm màu mới phải khai tường minh.
 * P5b thêm màn hình thật thì bổ sung khoá vào đây.
 */
export const MOBILE_COLOR_KEYS = [
  'background',
  'foreground',
  'card',
  'muted',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'border',
] as const;

export type MobileColorKey = (typeof MOBILE_COLOR_KEYS)[number];

/**
 * Bậc chữ và độ đậm mà bộ primitive thật sự dùng — cùng luật CURATED với
 * `MOBILE_COLOR_KEYS` ở trên, và vì cùng một lý do.
 *
 * Trước đây `type`/`weight` đi thẳng qua không cổng: đổi tên `--text-base`
 * trong `tokens.mjs` (đúng thao tác mà ADR-0013 hứa là an toàn) làm
 * `theme.type.base` thành `undefined`, `AppText` render không có `fontSize`,
 * React Native rơi về 14dp — toàn bộ chữ body sai cỡ mà gate vẫn xanh. Hai
 * nửa của cùng một cầu thì phải chịu cùng một chuẩn.
 */
export const MOBILE_TYPE_STEPS = ['xs', 'sm', 'base', 'lg', '2xl', '3xl'] as const;
export type MobileTypeStep = (typeof MOBILE_TYPE_STEPS)[number];

export const MOBILE_FONT_WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const;
export type MobileFontWeightKey = (typeof MOBILE_FONT_WEIGHTS)[number];

/** Union `fontWeight` mà React Native chấp nhận. */
export type FontWeight = NonNullable<TextStyle['fontWeight']>;

export interface MobileTheme {
  /** Chế độ đang dùng — hữu ích cho component cần rẽ nhánh (vd bóng đổ). */
  scheme: ColorScheme;
  colors: Record<MobileColorKey, string>;
  radius: RnTheme['radius'];
  /** Type scale theo dp. Mọi bậc trong `MOBILE_TYPE_STEPS` chắc chắn có mặt. */
  type: Record<MobileTypeStep, { fontSize: number; lineHeight: number }>;
  /** Font weight dạng chuỗi mà React Native nhận (`'400'`, `'600'`, …). */
  weight: Record<MobileFontWeightKey, FontWeight>;
  /** `spacing(4)` = 4 bước gốc — cùng bội số mà Tailwind dùng cho `p-4`. */
  spacing: (steps: number) => number;
  /** Cạnh tối thiểu của vùng chạm theo dp (a11y). */
  touchTargetMin: number;
}

/**
 * Dựng theme cho một chế độ màu. `source` chỉ để test bơm cầu token giả — code
 * thật luôn dùng mặc định.
 */
export function buildTheme(scheme: ColorScheme, source: Partial<RnTheme> = {}): MobileTheme {
  const palette = (source.colors ?? tokens.colors)[scheme];
  const spacingBase = source.spacing ?? tokens.spacing;

  const colors = {} as Record<MobileColorKey, string>;
  for (const key of MOBILE_COLOR_KEYS) {
    const value = palette[key];
    if (value === undefined) {
      throw new Error(
        `@tourism/mobile-ui: cầu token thiếu màu "${key}" ở chế độ ${scheme}. ` +
          'Đổi tên token thì phải cập nhật MOBILE_COLOR_KEYS.',
      );
    }
    colors[key] = value;
  }

  const rawType = source.type ?? tokens.type;
  const type = {} as MobileTheme['type'];
  for (const step of MOBILE_TYPE_STEPS) {
    const value = rawType[step];
    if (value === undefined) {
      throw new Error(
        `@tourism/mobile-ui: cầu token thiếu bậc chữ "${step}". ` +
          'Đổi tên token thì phải cập nhật MOBILE_TYPE_STEPS.',
      );
    }
    type[step] = value;
  }

  const rawWeight = source.weight ?? tokens.weight;
  const weight = {} as MobileTheme['weight'];
  for (const key of MOBILE_FONT_WEIGHTS) {
    const value = rawWeight[key];
    if (value === undefined) {
      throw new Error(
        `@tourism/mobile-ui: cầu token thiếu độ đậm "${key}". ` +
          'Đổi tên token thì phải cập nhật MOBILE_FONT_WEIGHTS.',
      );
    }
    // Cầu token phát font-weight dạng '400'…'700' — đều nằm trong union
    // `fontWeight` của RN, nhưng `.d.ts` sinh ra chỉ khai `Record<string,
    // string>`. Ép ở ĐÂY, một chỗ, và để spec canh rằng lời ép đó đúng.
    weight[key] = value as FontWeight;
  }

  return {
    scheme,
    colors,
    radius: source.radius ?? tokens.radius,
    type,
    weight,
    spacing: (steps: number) => spacingBase * steps,
    touchTargetMin: source.touchTargetMin ?? tokens.touchTargetMin,
  };
}
