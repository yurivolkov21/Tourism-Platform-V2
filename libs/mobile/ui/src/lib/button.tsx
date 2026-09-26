import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { AppText } from './app-text';
import { type MobileColorKey, withAlpha } from './theme';
import { useTheme } from './theme-provider';

/**
 * Bốn vai của nút, mỗi vai một cặp màu token. `background: null` nghĩa là nền
 * trong suốt — nút viền, không phải một màu token nào; `border` khai luôn màu và
 * độ đậm của viền để không vai nào phải đặc cách trong thân component.
 */
export const BUTTON_VARIANTS = {
  primary: { background: 'primary', foreground: 'primary-foreground', border: null },
  secondary: { background: 'secondary', foreground: 'secondary-foreground', border: null },
  ghost: { background: null, foreground: 'primary', border: { color: 'border', alpha: 1 } },
  // A5 (Sign out) — chữ LẤY MÀU `background` của theme (không phải
  // `primary-foreground` cố định): tương phản đúng ở CẢ hai theme vì
  // `destructive-emphasis` là màu sáng ở dark mode, màu tối ở light mode —
  // "background" luôn là đầu đối lập của nó trong bảng màu. Mockup 21/09 dùng
  // đúng cặp này, không phải chọn ngẫu nhiên.
  destructive: { background: 'destructive-emphasis', foreground: 'background', border: null },
  // Nút phụ nằm TRÊN ẢNH (onboarding trang cuối): chữ lấy màu chữ-trên-ảnh, viền
  // cùng màu nhưng pha loãng để không cắt ngang ảnh.
  media: { background: null, foreground: 'on-media', border: { color: 'on-media', alpha: 0.35 } },
} as const satisfies Record<
  string,
  {
    background: MobileColorKey | null;
    foreground: MobileColorKey;
    border: { color: MobileColorKey; alpha: number } | null;
  }
>;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  /**
   * Icon đứng trước nhãn — nhận sẵn một node để nút không phải biết bộ icon nào
   * (chữ G của Google chẳng hạn không nằm trong bộ Feather).
   */
  leading?: ReactNode;
  /** `pill` cho nút bo tròn hết cỡ của cụm auth; mặc định bo theo token. */
  shape?: 'rounded' | 'pill';
}

/** Nút bấm của app. Vùng chạm luôn ≥ ngưỡng a11y trong token. */
export function Button({
  label,
  variant = 'primary',
  leading,
  shape = 'rounded',
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const { background, foreground, border } = BUTTON_VARIANTS[variant];
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
  // Pill cao 46dp như `.btn` của bản vẽ cụm auth, nhưng lấy ngưỡng a11y của token
  // làm sàn: nâng `--touch-target-min` thì pill lên theo, không tụt dưới ngưỡng.
  const pillHeight = Math.max(theme.touchTargetMin, theme.spacing(11.5));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor,
          borderRadius: shape === 'pill' ? pillHeight : theme.radius.base,
          flexDirection: 'row',
          gap: theme.spacing(2),
          minHeight: shape === 'pill' ? pillHeight : theme.touchTargetMin,
          paddingHorizontal: theme.spacing(5),
          alignItems: 'center',
          justifyContent: 'center',
        },
        border !== null && {
          borderWidth: 1,
          borderColor: withAlpha(theme.colors[border.color], border.alpha),
        },
        // Phản hồi khi ngón còn đặt trên nút — mờ đi thay vì đổi màu, để cùng
        // một cách với mọi biến thể mà không cần thêm khoá token.
        pressed && !isDisabled && { opacity: 0.8 },
      ]}
      {...rest}
    >
      {leading}
      <AppText variant="label" style={{ color: textColor }}>
        {label}
      </AppText>
    </Pressable>
  );
}
