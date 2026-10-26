import { useTheme, withAlpha } from '@tourism/mobile-ui';
import { View } from 'react-native';
import Reanimated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

const DOT = 6;
const ACTIVE_WIDTH = 18;

/**
 * Dải chấm báo ảnh bìa đang xem. Chấm co giãn THEO vị trí cuộn ngang (`scrollX`, shared value cập
 * nhật từ luồng UI): kéo nửa chừng giữa hai ảnh thì chấm cũ thu lại, chấm mới giãn ra cùng lúc,
 * không phải nhảy khi cuộn xong. Ẩn khỏi trình đọc màn hình — bộ đếm "1 / 5" đã đọc đủ thông tin.
 */
export function HeroDots({
  count,
  scrollX,
  pageWidth,
}: {
  count: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
}) {
  if (count <= 1) return null;

  return (
    <View
      testID="tour-detail-hero-dots"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: số chấm cố định theo số ảnh, không chèn/xoá giữa chừng.
        <Dot key={index} index={index} scrollX={scrollX} pageWidth={pageWidth} />
      ))}
    </View>
  );
}

function Dot({
  index,
  scrollX,
  pageWidth,
}: {
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
}) {
  const theme = useTheme();

  const style = useAnimatedStyle(() => {
    // Khoảng cách (tính theo trang) từ vị trí đang cuộn tới trang của chấm này.
    const distance = Math.abs(scrollX.value / pageWidth - index);
    return {
      width: interpolate(distance, [0, 1], [ACTIVE_WIDTH, DOT], Extrapolation.CLAMP),
      opacity: interpolate(distance, [0, 1], [1, 0.55], Extrapolation.CLAMP),
    };
  });

  return (
    <Reanimated.View
      style={[
        {
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: withAlpha(theme.colors['on-media'], 1),
        },
        style,
      ]}
    />
  );
}
