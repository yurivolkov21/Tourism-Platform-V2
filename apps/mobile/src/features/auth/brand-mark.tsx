import { useTheme } from '@tourism/mobile-ui';
import { View } from 'react-native';

export interface BrandMarkProps {
  /** `lg` cho splash và onboarding; mặc định `sm` cho chỗ chật. */
  size?: 'sm' | 'lg';
}

/**
 * Logo hai viên kim cương lồng nhau, đúng mark của web (`apps/web/src/components/logo.tsx`).
 *
 * Vẽ bằng hai `View` xoay 45 độ thay vì SVG: hình chỉ là hai hình vuông bo góc,
 * nên kéo `react-native-svg` về đây là trả một dependency cho thứ CSS làm được.
 */
export function BrandMark({ size = 'sm' }: BrandMarkProps) {
  const theme = useTheme();
  const side = size === 'lg' ? theme.spacing(8.5) : theme.spacing(3.25);
  const overlap = side * 0.69;

  const diamond = (color: string, left: number) => ({
    position: 'absolute' as const,
    top: side * 0.25,
    left,
    width: side,
    height: side,
    borderRadius: theme.radius.base * (size === 'lg' ? 1.35 : 0.5),
    backgroundColor: color,
    transform: [{ rotate: '45deg' }],
  });

  return (
    <View style={{ width: side + overlap + side * 0.5, height: side * 1.5 }}>
      <View testID="brand-diamond" style={diamond(theme.colors.primary, side * 0.15)} />
      <View
        testID="brand-diamond"
        style={diamond(theme.colors.foreground, side * 0.15 + overlap)}
      />
    </View>
  );
}
