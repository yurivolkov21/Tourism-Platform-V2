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
 * Những khoá màu mà bộ primitive hiện tại thật sự dùng. Cố ý là danh sách
 * CURATED chứ không phải cả bảng token: nó biến "token bị đổi tên" từ một lỗi
 * chạy mới biết thành một lỗi ném ngay lúc dựng theme, và bắt người thêm màu
 * mới phải khai tường minh.
 */
export const MOBILE_COLOR_KEYS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'muted',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'accent',
  'accent-foreground',
  'border',
] as const;

export type MobileColorKey = (typeof MOBILE_COLOR_KEYS)[number];

/** Union `fontWeight` mà React Native chấp nhận. */
export type FontWeight = NonNullable<TextStyle['fontWeight']>;

export interface MobileTheme {
  /** Chế độ đang dùng — hữu ích cho component cần rẽ nhánh (vd bóng đổ). */
  scheme: ColorScheme;
  colors: Record<MobileColorKey, string>;
  radius: RnTheme['radius'];
  /** Type scale theo dp, khoá là bậc Tailwind (`xs`, `sm`, `base`, `lg`, …). */
  type: RnTheme['type'];
  /** Font weight dạng chuỗi mà React Native nhận (`'400'`, `'600'`, …). */
  weight: Record<string, FontWeight>;
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

  return {
    scheme,
    colors,
    radius: source.radius ?? tokens.radius,
    type: source.type ?? tokens.type,
    // Cầu token phát font-weight dạng '400'…'700' — đều nằm trong union
    // `fontWeight` của RN, nhưng `.d.ts` sinh ra chỉ khai `Record<string,
    // string>`. Ép ở ĐÂY, một chỗ, và để spec canh rằng lời ép đó đúng.
    weight: (source.weight ?? tokens.weight) as Record<string, FontWeight>,
    spacing: (steps: number) => spacingBase * steps,
    touchTargetMin: source.touchTargetMin ?? tokens.touchTargetMin,
  };
}
