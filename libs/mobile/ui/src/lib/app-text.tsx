import { Text, type TextProps } from 'react-native';
import type { MobileFontWeightKey, MobileTheme, MobileTypeStep } from './theme';
import { useTheme } from './theme-provider';

/**
 * Bậc chữ theo VAI TRÒ, ánh xạ sang bậc token. Component không bao giờ viết
 * `fontSize` bằng số — đổi type scale ở `tokens.mjs` là cả app đổi theo
 * (CLAUDE.md #6).
 */
export const APP_TEXT_VARIANTS = {
  display: { step: '3xl', weight: 'bold' },
  title: { step: '2xl', weight: 'semibold' },
  heading: { step: 'lg', weight: 'semibold' },
  body: { step: 'base', weight: 'normal' },
  label: { step: 'sm', weight: 'medium' },
  caption: { step: 'xs', weight: 'normal' },
} as const satisfies Record<string, { step: MobileTypeStep; weight: MobileFontWeightKey }>;

export type AppTextVariant = keyof typeof APP_TEXT_VARIANTS;

/** Hai bậc lấy khuôn chữ tiêu đề (serif brand); các bậc còn lại dùng khuôn thân. */
const HEADING_VARIANTS = new Set<AppTextVariant>(['display', 'title']);

/** Vai màu của chữ. `muted` cho câu phụ, `inverse` cho chữ nằm trên nền brand. */
export type AppTextTone = 'default' | 'muted' | 'inverse';

const TONE_COLOR: Record<AppTextTone, keyof MobileTheme['colors']> = {
  default: 'foreground',
  muted: 'muted-foreground',
  inverse: 'primary-foreground',
};

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  tone?: AppTextTone;
}

/** Chữ của app. Mọi chuỗi hiển thị đi qua đây thay vì `<Text>` trần. */
export function AppText({ variant = 'body', tone = 'default', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const { step, weight } = APP_TEXT_VARIANTS[variant];
  // KHÔNG optional-chaining: `buildTheme` đã bảo đảm mọi bậc trong
  // `MOBILE_TYPE_STEPS` có mặt (ném lỗi nêu tên khoá nếu thiếu). Dùng `?.` ở
  // đây là biến một lỗi ném-ngay thành `undefined` lặng lẽ → RN rơi về 14dp và
  // cả app sai cỡ chữ mà không gì đỏ.
  const scale = theme.type[step];
  // Hai bậc tiêu đề dùng khuôn serif của brand; còn lại dùng khuôn thân theo
  // đúng độ đậm của bậc. KHÔNG đặt `fontWeight` kèm theo: family đã mang sẵn độ
  // đậm, đặt cả hai thì Android bôi đậm giả (xem `MOBILE_FONTS`).
  const fontFamily = HEADING_VARIANTS.has(variant) ? theme.fonts.heading : theme.fonts[weight];

  return (
    <Text
      style={[
        {
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          fontFamily,
          color: theme.colors[TONE_COLOR[tone]],
        },
        style,
      ]}
      {...rest}
    />
  );
}
