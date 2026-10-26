import { Pressable } from 'react-native';
import { Icon } from './icon';
import type { FeatherIconName } from './text-field';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface IconButtonProps {
  icon: FeatherIconName;
  /** Bắt buộc: nút chỉ có icon thì đây là thứ DUY NHẤT trình đọc màn hình đọc được. */
  accessibilityLabel: string;
  onPress: () => void;
  /**
   * `glass` cho nút nằm trên ảnh (nền mờ, chữ sáng); `plain` cho nền thường; `link` là nút không nền
   * với icon màu `primary-emphasis` — đi cặp với chữ `tone="link"` bên cạnh (kính lúp ở Home).
   */
  variant?: 'glass' | 'plain' | 'link';
  /**
   * Cỡ icon. Mặc định 18 (nút phụ: đóng, hiện/ẩn mật khẩu); nút chính trên
   * đầu màn cần to hơn — vùng chạm KHÔNG đổi theo, vẫn `touchTargetMin`.
   */
  size?: number;
}

/**
 * Nút chỉ có icon — nút đóng, nút quay lại, nút hiện/ẩn. Vùng chạm luôn ≥
 * `touchTargetMin` của token dù icon bé, vì đây đúng là chỗ người ta hay bấm hụt.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  size = 18,
}: IconButtonProps) {
  const theme = useTheme();
  const onMedia = variant === 'glass';
  const iconColor = onMedia
    ? theme.colors['on-media']
    : variant === 'link'
      ? theme.colors['primary-emphasis']
      : theme.colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      // Gợn sóng tròn trong vùng chạm: nút chỉ có icon trước đây bấm vào không thấy phản hồi gì.
      // Android thôi (iOS bỏ qua prop này); giữ `style` dạng object để spec đọc thẳng số đo.
      android_ripple={{
        color: withAlpha(iconColor, 0.2),
        radius: theme.touchTargetMin / 2,
      }}
      style={{
        minWidth: theme.touchTargetMin,
        minHeight: theme.touchTargetMin,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.touchTargetMin / 2,
        backgroundColor: onMedia ? withAlpha(theme.colors.scrim, 0.45) : undefined,
      }}
    >
      <Icon name={icon} size={size} color={iconColor} />
    </Pressable>
  );
}
