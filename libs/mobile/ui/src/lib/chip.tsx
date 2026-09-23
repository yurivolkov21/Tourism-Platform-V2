import Feather from '@expo/vector-icons/Feather';
import { Pressable, View, type ViewStyle } from 'react-native';
import { AppText } from './app-text';
import type { MobileColorKey } from './theme';
import { useTheme } from './theme-provider';

export type ChipVariant = 'default' | 'selected' | 'removable';

const CHIP_VARIANTS = {
  default: { background: null, border: 'border', foreground: 'foreground' },
  selected: { background: 'primary', border: 'primary', foreground: 'primary-foreground' },
  removable: { background: 'secondary', border: 'secondary', foreground: 'secondary-foreground' },
} as const satisfies Record<
  ChipVariant,
  { background: MobileColorKey | null; border: MobileColorKey; foreground: MobileColorKey }
>;

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  onPress?: () => void;
  /** Chỉ dùng khi `variant="removable"`. */
  onRemove?: () => void;
}

/** Chip pill (`.chip`/`.chip.on`/`.chip.soft` bản vẽ 18/09 — ADR-0047 T0). */
export function Chip({ label, variant = 'default', onPress, onRemove }: ChipProps) {
  const theme = useTheme();
  const { background, border, foreground } = CHIP_VARIANTS[variant];

  const shellStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    height: theme.spacing(8),
    paddingHorizontal: theme.spacing(3.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors[border],
    backgroundColor: background === null ? 'transparent' : theme.colors[background],
    gap: theme.spacing(1.5),
  };

  const labelNode = (
    <AppText
      variant="label"
      style={{
        color: theme.colors[foreground],
        fontFamily: variant === 'selected' ? theme.fonts.semibold : theme.fonts.medium,
      }}
    >
      {label}
    </AppText>
  );

  if (variant === 'removable') {
    // Shell là `View` thường, KHÔNG phải `Pressable`: `Pressable` mặc định
    // `accessible: true`, khiến iOS gộp hết con cháu thành một khối chọn duy
    // nhất, nuốt mất nút "x" lồng bên trong — VoiceOver không bao giờ focus
    // riêng được nút đó (onPress của cả chip cũng thường bỏ trống ở biến thể
    // này, nên khối gộp lại vô nghĩa). Nút "x" là `Pressable` DUY NHẤT ở đây.
    return (
      <View style={shellStyle}>
        {labelNode}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          // Icon "x" chỉ 14dp — hitSlop bù thêm ~16dp mỗi cạnh để vùng chạm
          // chạm tới ngưỡng touchTargetMin (44dp), theo đúng quy ước a11y của
          // package này (xem button.tsx, icon-button.tsx).
          hitSlop={theme.spacing(4)}
          onPress={onRemove}
        >
          <Feather name="x" size={14} color={theme.colors[foreground]} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      // Chip cao 32dp (mockup ấn định) — thấp hơn touchTargetMin (44dp). Bù
      // vùng chạm bằng hitSlop dọc thay vì đổi chiều cao nhìn thấy được.
      hitSlop={{ top: theme.spacing(1.5), bottom: theme.spacing(1.5) }}
      style={shellStyle}
    >
      {labelNode}
    </Pressable>
  );
}
