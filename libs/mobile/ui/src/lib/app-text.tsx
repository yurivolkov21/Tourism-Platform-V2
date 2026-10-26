import { Text, type TextProps } from 'react-native';
import type { MobileFontWeightKey, MobileTheme, MobileTypeStep } from './theme';
import { useTheme } from './theme-provider';

/**
 * Bậc chữ theo VAI TRÒ, ánh xạ sang bậc token. Component không bao giờ viết
 * `fontSize` bằng số — đổi type scale ở `tokens.mjs` là cả app đổi theo
 * (CLAUDE.md #6).
 */
export const APP_TEXT_VARIANTS = {
  display: { step: '3xl', weight: 'normal' },
  title: { step: '2xl', weight: 'normal' },
  heading: { step: 'base', weight: 'medium' },
  /** Câu dẫn dưới một tiêu đề `display` — nhỏ hơn chữ thân để tiêu đề còn nổi. */
  subtitle: { step: 'sm', weight: 'normal' },
  body: { step: 'base', weight: 'normal' },
  label: { step: 'sm', weight: 'medium' },
  caption: { step: 'xs', weight: 'normal' },
  /**
   * Chữ thương hiệu (Literata) — CHỈ cho chữ nằm trên ảnh và con số thương hiệu:
   * tiêu đề onboarding, tên địa danh, tên tour trên ảnh đầu trang, số đếm ngược,
   * "You're going!", tiêu đề bài viết. Còn lại là chữ hệ thống (ADR-0040 AMEND 7).
   */
  brand: { step: '3xl', weight: 'bold' },
} as const satisfies Record<string, { step: MobileTypeStep; weight: MobileFontWeightKey }>;

export type AppTextVariant = keyof typeof APP_TEXT_VARIANTS;

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

/**
 * Kiểu chữ đã phân giải theo vai trò + vai màu. Tách khỏi `AppText` để những chỗ không dùng được
 * `<Text>` (vd ô `TextInput` chỉ đọc cho số chạy trên luồng UI) vẫn ra cùng cỡ chữ, độ đậm, màu.
 */
export function useAppTextStyle(variant: AppTextVariant = 'body', tone: AppTextTone = 'default') {
  const theme = useTheme();
  const { step, weight } = APP_TEXT_VARIANTS[variant];
  // KHÔNG optional-chaining: `buildTheme` đã bảo đảm mọi bậc trong
  // `MOBILE_TYPE_STEPS` có mặt (ném lỗi nêu tên khoá nếu thiếu). Dùng `?.` ở
  // đây là biến một lỗi ném-ngay thành `undefined` lặng lẽ → RN rơi về 14dp và
  // cả app sai cỡ chữ mà không gì đỏ.
  const scale = theme.type[step];
  // Chữ hệ thống đặt `fontWeight` và KHÔNG đặt `fontFamily`; `brand` làm ngược lại:
  // family Literata đã mang sẵn độ đậm, đặt thêm `fontWeight` thì Android bôi đậm
  // giả (bàn giao nâng cấp UI mục 7.1).
  const face =
    variant === 'brand'
      ? { fontFamily: theme.fonts.heading }
      : { fontWeight: theme.weight[weight] };

  return {
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    ...face,
    color: theme.colors[TONE_COLOR[tone]],
  };
}

/** Chữ của app. Mọi chuỗi hiển thị đi qua đây thay vì `<Text>` trần. */
export function AppText({ variant = 'body', tone = 'default', style, ...rest }: AppTextProps) {
  return <Text style={[useAppTextStyle(variant, tone), style]} {...rest} />;
}
