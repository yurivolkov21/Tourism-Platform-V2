import Feather from '@expo/vector-icons/Feather';
import { Pressable } from 'react-native';
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

  return (
    <Pressable
      accessibilityRole="button"
      // Đặt nhãn tường minh: nếu không, tên a11y của chip sẽ gộp cả nhãn "Remove
      // …" của nút x lồng bên trong (VoiceOver đọc "Trekking Remove Trekking"),
      // và khiến truy vấn theo tên "remove …" khớp NHẦM cả chip lẫn nút x.
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: theme.spacing(8),
        paddingHorizontal: theme.spacing(3.5),
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors[border],
        backgroundColor: background === null ? 'transparent' : theme.colors[background],
        gap: theme.spacing(1.5),
      }}
    >
      <AppText
        variant="label"
        style={{
          color: theme.colors[foreground],
          fontFamily: variant === 'selected' ? theme.fonts.semibold : theme.fonts.medium,
        }}
      >
        {label}
      </AppText>
      {variant === 'removable' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          hitSlop={theme.spacing(2)}
          onPress={onRemove}
        >
          <Feather name="x" size={14} color={theme.colors[foreground]} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
