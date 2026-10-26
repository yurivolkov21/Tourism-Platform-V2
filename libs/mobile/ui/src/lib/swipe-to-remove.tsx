import type { ReactNode } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from './app-text';
import { Icon } from './icon';
import { useTheme } from './theme-provider';

export interface SwipeToRemoveProps {
  /** Vuốt sang trái đủ xa (hoặc đủ nhanh) thì gọi một lần; cha lo việc gỡ thật. */
  onRemove: () => void;
  /** Chữ hiện sau thẻ khi đang vuốt ("Remove"). */
  label: string;
  /** Tắt vuốt (vd thẻ đang co lại để gỡ). */
  disabled?: boolean;
  children: ReactNode;
}

/** Vuốt quá nửa chiều ngang thẻ HOẶC vẩy sang trái đủ nhanh (px/s) thì gỡ. */
const REMOVE_FRACTION = 0.4;
const REMOVE_VELOCITY = -900;
/** Cử chỉ chỉ bắt đầu khi lệch ngang đủ xa và chưa lệch dọc — nhường cuộn dọc cho danh sách. */
const ACTIVE_OFFSET_X = 16;
const FAIL_OFFSET_Y = 12;

/**
 * Vuốt thẻ sang trái để gỡ (kiểu Mail): thẻ trượt theo ngón tay, lộ nền đỏ + nhãn phía sau, thả
 * quá ngưỡng thì trượt hẳn ra ngoài rồi gọi `onRemove`, chưa tới ngưỡng thì lò xo về chỗ cũ.
 * Mọi tính toán cử chỉ chạy trên luồng UI. Đây chỉ là lối tắt — nút trên thẻ vẫn là đường chính
 * (người dùng trình đọc màn hình không vuốt được).
 */
export function SwipeToRemove({ onRemove, label, disabled = false, children }: SwipeToRemoveProps) {
  const theme = useTheme();
  const x = useSharedValue(0);
  const width = useSharedValue(0);

  const pan = Gesture.Pan()
    .withTestId('swipe-to-remove-pan')
    .enabled(!disabled)
    .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
    .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
    .onUpdate((event) => {
      // Chỉ vuốt được sang trái.
      x.value = Math.min(0, event.translationX);
    })
    .onEnd((event) => {
      const far = x.value < -width.value * REMOVE_FRACTION;
      if (far || event.velocityX < REMOVE_VELOCITY) {
        x.value = withTiming(-width.value, { duration: 160 }, (finished) => {
          if (finished) runOnJS(onRemove)();
        });
      } else {
        x.value = withSpring(0, { stiffness: 220, damping: 22 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-96, -16, 0], [1, 0.4, 0]),
  }));

  return (
    <View
      testID="swipe-to-remove"
      onLayout={(event: LayoutChangeEvent) => (width.value = event.nativeEvent.layout.width)}
    >
      <Reanimated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: theme.radius.base * 3,
            backgroundColor: theme.colors['destructive-emphasis'],
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingRight: theme.spacing(6),
            gap: theme.spacing(1),
          },
          backStyle,
        ]}
      >
        <Icon name="trash-2" size={22} color={theme.colors['primary-foreground']} />
        <AppText variant="caption" style={{ color: theme.colors['primary-foreground'] }}>
          {label}
        </AppText>
      </Reanimated.View>
      <GestureDetector gesture={pan}>
        <Reanimated.View style={cardStyle}>{children}</Reanimated.View>
      </GestureDetector>
    </View>
  );
}
