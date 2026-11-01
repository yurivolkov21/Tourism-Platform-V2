import { Image } from 'expo-image';
import { type ImageStyle, type StyleProp, StyleSheet } from 'react-native';
import { useTheme } from './theme-provider';

/**
 * Vân đồng mức (topo) — "chữ ký" nhận diện của Nexora bên web (`apps/web/src/components/topo-pattern.tsx`:
 * hero trang tour, cụm đăng nhập, chân trang). Đem xuống mobile 01/11 (user chọn từ đợt rà style web).
 *
 * DÙNG LẠI đúng hai file SVG của web (`apps/web/public/images/auth-topo.svg`, `topo-wide.svg`, chép vào
 * `assets/`), vẽ bằng `expo-image` có sẵn — không thêm `react-native-svg` (freeze 31/10: không thêm
 * dependency). SVG chỉ là nét trắng; `tintColor` đổi màu theo theme và `opacity` giữ nó mờ như vân
 * nền, đúng cách web đặt "màu + độ mờ tại chỗ gọi".
 *
 * Phủ kín cha (`absoluteFill`) và không nhận chạm — đặt nó làm con ĐẦU TIÊN của khối cần vân để
 * nội dung vẽ đè lên trên.
 */
const SOURCES = {
  /** 900×1000 — khối cao/dọc (màn đăng nhập, trạng thái trống, thẻ đếm ngược). */
  portrait: require('../../assets/topo-portrait.svg'),
  /** 1800×700 — dải ngang rộng. */
  wide: require('../../assets/topo-wide.svg'),
} as const;

export interface TopoPatternProps {
  variant?: keyof typeof SOURCES;
  /** Độ đậm của vân (0–1). Mặc định 0,08 — thấy được trên nền tối mà không át chữ. */
  opacity?: number;
  /** Màu nét; mặc định `foreground` của theme (nét sáng trên nền tối, nét tối trên nền sáng). */
  color?: string;
  style?: StyleProp<ImageStyle>;
}

export function TopoPattern({
  variant = 'portrait',
  opacity = 0.08,
  color,
  style,
}: TopoPatternProps) {
  const theme = useTheme();
  return (
    <Image
      testID="topo-pattern"
      source={SOURCES[variant]}
      contentFit="cover"
      tintColor={color ?? theme.colors.foreground}
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFill, { opacity }, style]}
    />
  );
}
