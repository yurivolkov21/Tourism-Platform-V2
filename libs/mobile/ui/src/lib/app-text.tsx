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
  /** Câu dẫn dưới một tiêu đề `display` — nhỏ hơn chữ thân để tiêu đề còn nổi. */
  subtitle: { step: 'sm', weight: 'normal' },
  body: { step: 'base', weight: 'normal' },
  // `semibold` chứ không `medium`: nhãn nút và chữ bấm được phải nặng hơn chữ
  // thường quanh nó mới ra dáng bấm được (bản thiết kế 16/09 dùng Archivo 600).
  label: { step: 'sm', weight: 'semibold' },
  caption: { step: 'xs', weight: 'normal' },
} as const satisfies Record<string, { step: MobileTypeStep; weight: MobileFontWeightKey }>;

export type AppTextVariant = keyof typeof APP_TEXT_VARIANTS;

/** Hai bậc lấy khuôn chữ tiêu đề (serif brand); các bậc còn lại dùng khuôn thân. */
const HEADING_VARIANTS = new Set<AppTextVariant>(['display', 'title']);

/** Vai màu của chữ. `muted` cho câu phụ, `inverse` cho chữ nằm trên nền brand. */
export type AppTextTone = 'default' | 'muted' | 'inverse' | 'danger' | 'media' | 'link';

const TONE_COLOR: Record<AppTextTone, keyof MobileTheme['colors']> = {
  default: 'foreground',
  muted: 'muted-foreground',
  inverse: 'primary-foreground',
  // P5b-1: `danger` cho câu lỗi của ô, `media` cho chữ nằm trên ảnh. Hai vai này
  // đi qua tone thay vì `style={{ color }}` ở chỗ gọi — màu vẫn chỉ có một đường
  // ra, và `check-mobile-tokens-only.mjs` vẫn là lưới cuối.
  danger: 'destructive-emphasis',
  media: 'on-media',
  link: 'primary-emphasis',
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
