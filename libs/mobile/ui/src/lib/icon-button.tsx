import Feather from '@expo/vector-icons/Feather';
import { Pressable } from 'react-native';
import type { FeatherIconName } from './text-field';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface IconButtonProps {
  icon: FeatherIconName;
  /** Bắt buộc: nút chỉ có icon thì đây là thứ DUY NHẤT trình đọc màn hình đọc được. */
  accessibilityLabel: string;
  onPress: () => void;
  /** `glass` cho nút nằm trên ảnh (nền mờ, chữ sáng); `plain` cho nền thường. */
  variant?: 'glass' | 'plain';
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
}: IconButtonProps) {
  const theme = useTheme();
  const onMedia = variant === 'glass';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        minWidth: theme.touchTargetMin,
        minHeight: theme.touchTargetMin,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.touchTargetMin / 2,
        backgroundColor: onMedia ? withAlpha(theme.colors.scrim, 0.45) : undefined,
      }}
    >
      <Feather
        name={icon}
        size={18}
        color={onMedia ? theme.colors['on-media'] : theme.colors.foreground}
      />
    </Pressable>
  );
}
