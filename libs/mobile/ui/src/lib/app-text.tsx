import { Text, type TextProps } from 'react-native';
import type { MobileTheme } from './theme';
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
} as const;

export type AppTextVariant = keyof typeof APP_TEXT_VARIANTS;

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
  const scale = theme.type[step];

  return (
    <Text
      style={[
        {
          fontSize: scale?.fontSize,
          lineHeight: scale?.lineHeight,
          fontWeight: theme.weight[weight],
          color: theme.colors[TONE_COLOR[tone]],
        },
        style,
      ]}
      {...rest}
    />
  );
}
