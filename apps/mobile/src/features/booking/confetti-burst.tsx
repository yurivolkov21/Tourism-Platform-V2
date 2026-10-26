import { useTheme } from '@tourism/mobile-ui';
import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

const PIECE_COUNT = 40;
const DURATION_MS = 2600;

interface Piece {
  startX: number; // 0..1 theo bề ngang màn hình
  drift: number; // px lệch ngang khi rơi
  size: number;
  spins: number; // số vòng xoay
  delay: number;
  round: boolean;
  colorIndex: number;
}

/**
 * Pháo giấy một lần khi đặt chỗ xong. Chỉ dùng Animated có sẵn (freeze
 * dependency 31/10); bỏ qua hoàn toàn khi máy bật "giảm chuyển động".
 */
export function ConfettiBurst({ fallDistance }: { fallDistance: number }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const height = fallDistance;
  const progress = useRef(new Animated.Value(0)).current;

  // Ngẫu nhiên một lần cho mỗi lần mount — không đổi khi re-render.
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: PIECE_COUNT }, () => ({
        startX: Math.random(),
        drift: (Math.random() - 0.5) * 120,
        size: 7,
        spins: 1 + Math.random() * 3,
        delay: Math.random() * 0.35,
        round: Math.random() > 0.6,
        colorIndex: Math.floor(Math.random() * 4),
      })),
    [],
  );

  const colors = [
    theme.colors.rating,
    theme.colors['primary-emphasis'],
    theme.colors['destructive-emphasis'],
    theme.colors.success,
  ];

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      animation.start();
    });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [progress]);

  return (
    <>
      {pieces.map((piece, index) => {
        // Mỗi mảnh có đoạn tiến độ riêng (trễ theo delay) để không rơi đồng loạt.
        const local = {
          inputRange: [piece.delay, 1],
          extrapolate: 'clamp' as const,
        };
        return (
          <Animated.View
            // biome-ignore lint/suspicious/noArrayIndexKey: danh sách tĩnh, không sắp xếp lại
            key={index}
            pointerEvents="none"
            accessible={false}
            style={[
              styles.piece,
              {
                left: piece.startX * width,
                width: piece.size,
                height: piece.round ? piece.size : 12,
                borderRadius: piece.round ? piece.size / 2 : 2,
                backgroundColor: colors[piece.colorIndex],
                opacity: progress.interpolate({
                  inputRange: [0, piece.delay, 0.8, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: progress.interpolate({
                      ...local,
                      outputRange: [-20, height],
                    }),
                  },
                  {
                    translateX: progress.interpolate({
                      ...local,
                      outputRange: [0, piece.drift],
                    }),
                  },
                  {
                    rotate: progress.interpolate({
                      ...local,
                      outputRange: ['0deg', `${piece.spins * 360}deg`],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0 },
});
