import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './theme-provider';

export interface SkeletonProps {
  style?: StyleProp<ViewStyle>;
}

const PULSE_MS = 800;
const PULSE_LOW = 0.35;

/**
 * Khối giữ chỗ khi đang tải: nền `muted` nhấp nháy nhẹ (opacity 1 ↔ 0.35) để người dùng
 * thấy app còn sống thay vì một mảng xám đứng im. Chỉ animate opacity nên chạy trên native
 * driver; máy bật "giảm chuyển động" thì đứng yên.
 */
export function Skeleton({ style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      const step = (toValue: number) =>
        Animated.timing(opacity, {
          toValue,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        });
      loop = Animated.loop(Animated.sequence([step(PULSE_LOW), step(1)]));
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: theme.colors.muted, opacity }, style]}
    />
  );
}
