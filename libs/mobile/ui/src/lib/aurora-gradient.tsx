import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Image,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface AuroraGradientProps {
  /** Độ đậm của màu phủ (0–1). Mặc định 0,3: đủ thấy giao thoa mà không át ảnh/chữ bên dưới. */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ảnh nhiễu đen/trắng 256x256 lát kín phủ lên cuối: gradient nhạt trên màn 8 bit bị "vỡ mảng" (mỗi
 * bậc màu thành một dải rộng, nhìn như rỗ); rải nhiễu nhỏ làm ranh giới các bậc nhoè đi (dither).
 * Sinh bằng script cố định nên ảnh luôn giống nhau. Lát tay bằng nhiều `Image` vì `resizeMode:
 * 'repeat'` của RN không lát được trên Android (chỉ vẽ một ô ở góc).
 */
const NOISE = require('../../assets/aurora-noise.png');
/** Cạnh một ô nhiễu (dp) — ảnh 256px vẽ 96dp, xấp xỉ 1 hạt = 1 điểm ảnh máy (hạt mịn). */
const NOISE_TILE = 96;
/** Độ đậm của lớp nhiễu — đủ phá dải mà không thấy hạt. */
const NOISE_OPACITY = 0.025;

function NoiseOverlay() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const columns = size === null ? 0 : Math.ceil(size.width / NOISE_TILE);
  const rows = size === null ? 0 : Math.ceil(size.height / NOISE_TILE);

  return (
    <View
      pointerEvents="none"
      onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)}
      style={[StyleSheet.absoluteFill, { opacity: NOISE_OPACITY, overflow: 'hidden' }]}
    >
      {Array.from({ length: columns * rows }, (_, index) => (
        <Image
          // biome-ignore lint/suspicious/noArrayIndexKey: lưới ô cố định theo kích thước khung, không đổi thứ tự.
          key={index}
          source={NOISE}
          style={{
            position: 'absolute',
            width: NOISE_TILE,
            height: NOISE_TILE,
            left: (index % columns) * NOISE_TILE,
            top: Math.floor(index / columns) * NOISE_TILE,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Nền "giao thoa màu": hai gradient chéo ngược hướng nhau, pha bằng token thương hiệu, chồng lên
 * nhau mỗi lớp 50% nên ở giữa hai dải màu hoà vào nhau. ĐỨNG YÊN (đã bỏ chuyển động — nhìn gọn hơn
 * và không tốn khung hình), cộng một lớp nhiễu chống vỡ mảng ở trên cùng.
 *
 * Mọi màu lấy từ `theme.colors` (tokens-only, tự đổi theo sáng/tối); `pointerEvents="none"` để đặt
 * đè lên ảnh hay thẻ mà không chặn chạm.
 */
export function AuroraGradient({ intensity = 0.3, style }: AuroraGradientProps) {
  const theme = useTheme();

  const { primary, secondary } = theme.colors;
  const emphasis = theme.colors['primary-emphasis'];

  return (
    <View testID="aurora-gradient" pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}>
        <LinearGradient
          colors={[
            withAlpha(primary, intensity),
            withAlpha(secondary, intensity),
            withAlpha(emphasis, intensity * 0.6),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}>
        <LinearGradient
          colors={[
            withAlpha(emphasis, intensity),
            withAlpha(primary, intensity * 0.7),
            withAlpha(secondary, intensity),
          ]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <NoiseOverlay />
    </View>
  );
}
