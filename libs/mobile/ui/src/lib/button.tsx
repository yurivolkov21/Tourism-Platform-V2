import { Pressable, type PressableProps, StyleSheet } from 'react-native';
import { AppText } from './app-text';
import type { MobileColorKey } from './theme';
import { useTheme } from './theme-provider';

/**
 * Ba vai của nút, mỗi vai một cặp màu token. `background: null` nghĩa là nền
 * trong suốt — nút viền, không phải một màu token nào.
 */
export const BUTTON_VARIANTS = {
  primary: { background: 'primary', foreground: 'primary-foreground', bordered: false },
  secondary: { background: 'secondary', foreground: 'secondary-foreground', bordered: false },
  ghost: { background: null, foreground: 'primary', bordered: true },
} as const satisfies Record<
  string,
  { background: MobileColorKey | null; foreground: MobileColorKey; bordered: boolean }
>;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
}

/** Nút bấm của app. Vùng chạm luôn ≥ ngưỡng a11y trong token. */
export function Button({ label, variant = 'primary', disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const { background, foreground, bordered } = BUTTON_VARIANTS[variant];
  // `PressableProps.disabled` cho phép cả `null`; quy về boolean thật một lần
  // để `accessibilityState` không bao giờ báo `null` cho trình đọc màn hình.
  const isDisabled = disabled === true;

  // Vô hiệu hoá đè lên mọi biến thể: nền muted, chữ muted — trạng thái này
  // phải nhìn ra ngay chứ không chỉ là giảm độ mờ.
  const backgroundColor = isDisabled
    ? theme.colors.muted
    : background === null
      ? 'transparent'
      : theme.colors[background];
  const textColor = isDisabled ? theme.colors['muted-foreground'] : theme.colors[foreground];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor,
          borderRadius: theme.radius.base,
          minHeight: theme.touchTargetMin,
          paddingHorizontal: theme.spacing(5),
          alignItems: 'center',
          justifyContent: 'center',
        },
        bordered && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        },
        // Phản hồi khi ngón còn đặt trên nút — mờ đi thay vì đổi màu, để cùng
        // một cách với mọi biến thể mà không cần thêm khoá token.
        pressed && !isDisabled && { opacity: 0.8 },
      ]}
      {...rest}
    >
      <AppText variant="label" style={{ color: textColor }}>
        {label}
      </AppText>
    </Pressable>
  );
}
