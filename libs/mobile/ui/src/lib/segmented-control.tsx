import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Reanimated, {
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAppTextStyle } from './app-text';
import { useTheme } from './theme-provider';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

const GAP = 2;
const HEIGHT = 40;
const END_RADIUS = 20;

/**
 * Segmented của Trips (N7, khung B10): các ô bằng nhau, cao 40, cách nhau 2, nền `containerHigh`. CHỈ hai
 * đầu bo 20, ô giữa vuông. Ô đang chọn là MỘT khối nền `primary` trượt tới ô mới (không đổi nền từng ô);
 * khối này đổi cả góc bo theo ô nó đang đứng nên ô chọn vẫn giữ nguyên hình — user chốt 19/10 không dùng
 * kiểu "connected button group" của Expressive.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const last = options.length - 1;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [innerWidth, setInnerWidth] = useState(0);
  const position = useSharedValue(selectedIndex);
  const placed = useRef(false);
  const cellWidth = (innerWidth - GAP * last) / options.length;

  useEffect(() => {
    if (innerWidth === 0) return;
    if (!placed.current) {
      position.value = selectedIndex;
      placed.current = true;
      return;
    }
    // Lò xo thay cho tween cố định: khối trượt có đà rồi lắng lại, bấm qua lại liên tục vẫn nối mượt
    // từ vị trí đang chạy dở chứ không giật về đầu. Cố ý không nảy quá đích (damping đủ lớn).
    position.value = withSpring(selectedIndex, { stiffness: 320, damping: 30, mass: 1 });
  }, [selectedIndex, innerWidth, position]);

  const stops = options.map((_, index) => index);
  const step = cellWidth + GAP;
  // Dịch ngang và góc bo đều chạy trên luồng UI.
  const indicatorStyle = useAnimatedStyle(() => {
    const leftRadius = interpolate(
      position.value,
      stops,
      stops.map((index) => (index === 0 ? END_RADIUS : 0)),
    );
    const rightRadius = interpolate(
      position.value,
      stops,
      stops.map((index) => (index === last ? END_RADIUS : 0)),
    );
    return {
      borderTopLeftRadius: leftRadius,
      borderBottomLeftRadius: leftRadius,
      borderTopRightRadius: rightRadius,
      borderBottomRightRadius: rightRadius,
      transform: [{ translateX: position.value * step }],
    };
  });
  const showIndicator = innerWidth > 0 && options.length >= 2;

  return (
    <View style={{ paddingHorizontal: theme.spacing(4) }}>
      <View
        testID="segmented-track"
        onLayout={(event: LayoutChangeEvent) => setInnerWidth(event.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
      >
        {/* Lớp nền: các ô `containerHigh`, hai đầu bo. */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            gap: GAP,
          }}
        >
          {options.map((option, index) => (
            <View
              key={option.value}
              style={{
                flex: 1,
                height: HEIGHT,
                backgroundColor: theme.surfaces.containerHigh,
                borderTopLeftRadius: index === 0 ? END_RADIUS : 0,
                borderBottomLeftRadius: index === 0 ? END_RADIUS : 0,
                borderTopRightRadius: index === last ? END_RADIUS : 0,
                borderBottomRightRadius: index === last ? END_RADIUS : 0,
              }}
            />
          ))}
        </View>

        {showIndicator ? (
          <Reanimated.View
            testID="segmented-indicator"
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                width: cellWidth,
                height: HEIGHT,
                backgroundColor: theme.colors.primary,
              },
              indicatorStyle,
            ]}
          />
        ) : null}

        {/* Lớp chạm + chữ, trong suốt, nằm trên khối trượt. */}
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => onChange(option.value)}
                // Ô cao 40 < ngưỡng a11y 44: bù bằng hitSlop dọc, không đổi hình.
                hitSlop={{ top: 2, bottom: 2 }}
                style={{
                  flex: 1,
                  height: HEIGHT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SegmentLabel label={option.label} index={index} position={position} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/**
 * Nhãn một ô: màu đổi liên tục theo vị trí khối trượt (đang chọn → chữ trên nền `primary`, rời đi →
 * chữ thường), nên màu chạy cùng nhịp với khối chứ không nhảy trước/sau nó.
 */
function SegmentLabel({
  label,
  index,
  position,
}: {
  label: string;
  index: number;
  position: SharedValue<number>;
}) {
  const theme = useTheme();
  const base = useAppTextStyle('label');
  const idle = theme.colors.foreground;
  const active = theme.colors['primary-foreground'];

  const style = useAnimatedStyle(() => ({
    color: interpolateColor(position.value, [index - 1, index, index + 1], [idle, active, idle]),
  }));

  return <Reanimated.Text style={[base, style]}>{label}</Reanimated.Text>;
}
