import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useTheme } from './theme-provider';

export interface RegionRailItem {
  key: string;
  label: string;
  /** Tên đầy đủ cho trình đọc màn hình — chữ hiển thị đã rút gọn và xoay dọc. */
  accessibilityLabel?: string;
}

export interface RegionRailProps {
  items: RegionRailItem[];
  selected: string;
  onSelect: (key: string) => void;
}

/**
 * Rail vùng dọc của Home — bố cục bê từ bản v1 (Nexora `RegionTabs`): cột hẹp
 * `alignSelf: stretch`, các đoạn chia `space-evenly`, mỗi đoạn là một hàng
 * XOAY -90° gồm nhãn. Vạch chỉ báo là MỘT khối duy nhất nằm ngoài các đoạn và
 * trượt dọc tới đoạn đang chọn (đo vị trí bằng `onLayout`).
 *
 * Nhãn ngắn ("North") giữ cho chữ xoay còn đọc được; a11y đọc tên vùng ĐẦY ĐỦ
 * và không xoay.
 */
export function RegionRail({ items, selected, onSelect }: RegionRailProps) {
  const theme = useTheme();
  const indicatorHeight = theme.type.base.fontSize * 3.5;
  const layouts = useRef<Record<string, { y: number; height: number }>>({});
  const translateY = useRef(new Animated.Value(0)).current;
  // Hiện vạch chỉ sau khi đã biết vị trí đầu tiên — tránh nháy ở đỉnh rail.
  const visible = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  const moveTo = (key: string) => {
    const box = layouts.current[key];
    if (box === undefined) return;
    const target = box.y + (box.height - indicatorHeight) / 2;
    if (!placed.current) {
      translateY.setValue(target);
      visible.setValue(1);
      placed.current = true;
      return;
    }
    // Lò xo thay cho tween: vạch trượt có đà rồi lắng, đổi vùng liên tục vẫn nối mượt.
    Animated.spring(translateY, {
      toValue: target,
      stiffness: 260,
      damping: 26,
      mass: 1,
      useNativeDriver: true,
    }).start();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: moveTo chỉ đọc ref, chạy khi đổi vùng
  useEffect(() => {
    moveTo(selected);
  }, [selected]);

  const hasSelected = items.some((item) => item.key === selected);

  return (
    <View
      style={{ width: theme.spacing(13), alignSelf: 'stretch', justifyContent: 'space-evenly' }}
    >
      {hasSelected ? (
        <Animated.View
          testID="region-rail-indicator"
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 3,
            height: indicatorHeight,
            borderRadius: theme.radius.base / 2,
            backgroundColor: theme.colors['primary-emphasis'],
            opacity: visible,
            transform: [{ translateY }],
          }}
        />
      ) : null}
      {items.map((item) => {
        const on = item.key === selected;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityState={{ selected: on }}
            hitSlop={10}
            onLayout={(event) => {
              layouts.current[item.key] = event.nativeEvent.layout;
              if (on) moveTo(item.key);
            }}
            onPress={() => {
              if (!on) onSelect(item.key);
            }}
            style={{ height: theme.spacing(30), alignItems: 'center', justifyContent: 'center' }}
          >
            {/* `transform` chỉ đổi lúc VẼ chứ không đổi khung layout — khung
                phải đủ rộng cho nhãn nằm ngang TRƯỚC khi xoay, nếu không chữ
                bị bẻ dòng rồi mới xoay. */}
            <View
              style={{
                width: theme.spacing(30),
                transform: [{ rotate: '-90deg' }],
                alignItems: 'center',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontWeight: on ? theme.weight.semibold : theme.weight.normal,
                  fontSize: theme.type.base.fontSize,
                  letterSpacing: 0.4,
                  color: on ? theme.colors['primary-emphasis'] : theme.colors['muted-foreground'],
                }}
              >
                {item.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
