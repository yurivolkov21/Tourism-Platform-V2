import { type ReactNode, useRef } from 'react';
import type { PressableProps } from 'react-native';
import { AppText } from './app-text';
import { PressableScale } from './motion';
import { type MobileColorKey, withAlpha } from './theme';
import { useTheme } from './theme-provider';

/**
 * Bốn vai của nút, mỗi vai một cặp màu token. `background: null` nghĩa là nền
 * trong suốt — nút viền, không phải một màu token nào; `border` khai luôn màu và
 * độ đậm của viền để không vai nào phải đặc cách trong thân component.
 */
export interface ButtonSpec {
  background: MobileColorKey | null;
  /** Pha loãng nền khi nút nằm trên ảnh; bỏ trống là nền đặc. */
  backgroundAlpha?: number;
  foreground: MobileColorKey;
  border: { color: MobileColorKey; alpha: number } | null;
}

export const BUTTON_VARIANTS = {
  primary: { background: 'primary', foreground: 'primary-foreground', border: null },
  secondary: { background: 'secondary', foreground: 'secondary-foreground', border: null },
  // N3 (mockup vòng 4): `.btn.ghost` thành nút TÔNG — nền `secondary`, chữ `secondary-foreground`,
  // không viền (bản vòng 1 là nút viền chữ `primary-emphasis`). Tên `ghost` giữ nguyên để 17 chỗ
  // gọi không phải đổi; hình dạng khác `secondary` ở chỗ nào thì bàn giao N3 chưa tách.
  ghost: { background: 'secondary', foreground: 'secondary-foreground', border: null },
  // N3 (mockup vòng 4): nền `destructive` đỏ đặc ở cả hai theme, chữ `primary-foreground` — vai
  // BỀ MẶT của `destructive` đã đo đạt tương phản. `destructive-emphasis` là màu MỰC (sáng ở
  // dark mode), đặt làm nền thì ra nút hồng nhạt chữ tối, lệch bản vẽ.
  destructive: { background: 'destructive', foreground: 'primary-foreground', border: null },
  // Nút phụ nằm TRÊN ẢNH (onboarding trang cuối, A2): nền trắng mờ — màu chữ-trên-ảnh
  // pha alpha 0,22 — không viền, chữ lấy màu chữ-trên-ảnh.
  media: {
    background: 'on-media',
    backgroundAlpha: 0.22,
    foreground: 'on-media',
    border: null,
  },
} as const satisfies Record<string, ButtonSpec>;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  /**
   * Icon đứng trước nhãn — nhận sẵn một node để nút không phải biết bộ icon nào
   * (chữ G của Google chẳng hạn không nằm trong bộ Feather).
   */
  leading?: ReactNode;
  /** `small` cho nút nhỏ (cao 40, bo 20, chữ 14); mặc định là nút 56. */
  size?: 'default' | 'small';
  /**
   * Không còn tác dụng: mọi nút đều bo tròn hết cỡ theo Material 3 (N3). Giữ prop
   * để khỏi sửa hàng chục chỗ gọi cùng lúc.
   */
  shape?: 'rounded' | 'pill';
}

/** Cao 56 / bo 28 cho nút thường, 40 / 20 cho nút nhỏ — số đo của bản vẽ Material 3. */
const BUTTON_HEIGHT = { default: 56, small: 40 } as const;

/** Hai lần bấm cách nhau dưới ngưỡng này coi là bấm đúp, lần sau bị bỏ. */
const DOUBLE_PRESS_GUARD_MS = 500;

/** Nút bấm của app. Vùng chạm luôn ≥ ngưỡng a11y trong token. */
export function Button({
  label,
  variant = 'primary',
  leading,
  size = 'default',
  shape: _shape,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  // Bấm đúp nhanh không chạy `onPress` hai lần (vd mở hai màn chồng nhau khi nút điều hướng).
  const lastPressAt = useRef(0);
  // Khai kiểu `ButtonSpec` để `border` giữ hình `{…} | null` dù hiện chưa biến thể nào có viền.
  const spec: ButtonSpec = BUTTON_VARIANTS[variant];
  const { background, foreground, border, backgroundAlpha = 1 } = spec;
  // `PressableProps.disabled` cho phép cả `null`; quy về boolean thật một lần
  // để `accessibilityState` không bao giờ báo `null` cho trình đọc màn hình.
  const isDisabled = disabled === true;

  // Vô hiệu hoá đè lên mọi biến thể: nền muted, chữ muted — trạng thái này
  // phải nhìn ra ngay chứ không chỉ là giảm độ mờ.
  const backgroundColor = isDisabled
    ? theme.colors.muted
    : background === null
      ? 'transparent'
      : backgroundAlpha === 1
        ? theme.colors[background]
        : withAlpha(theme.colors[background], backgroundAlpha);
  const textColor = isDisabled ? theme.colors['muted-foreground'] : theme.colors[foreground];
  const small = size === 'small';
  // Sàn a11y của token thắng số đo bản vẽ — nâng `--touch-target-min` thì nút lên theo.
  // Nút nhỏ (40) dưới ngưỡng nên bù bằng `hitSlop`, không đổi hình.
  const height = small
    ? BUTTON_HEIGHT.small
    : Math.max(theme.touchTargetMin, BUTTON_HEIGHT.default);
  const slop = Math.max(0, Math.ceil((theme.touchTargetMin - height) / 2));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={
        onPress == null
          ? undefined
          : (event) => {
              const now = Date.now();
              if (now - lastPressAt.current < DOUBLE_PRESS_GUARD_MS) return;
              lastPressAt.current = now;
              onPress(event);
            }
      }
      hitSlop={slop > 0 ? { top: slop, bottom: slop } : undefined}
      style={({ pressed }) => [
        {
          backgroundColor,
          borderRadius: height / 2,
          flexDirection: 'row',
          gap: theme.spacing(2),
          minHeight: height,
          paddingHorizontal: theme.spacing(small ? 4 : 6),
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
      <AppText
        variant={small ? 'label' : 'body'}
        style={{ color: textColor, fontWeight: theme.weight.medium }}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}
