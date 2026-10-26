import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './app-text';
import { useTheme } from './theme-provider';

/**
 * Tập con CẤU TRÚC của `BottomTabBarProps` (react-navigation).
 * `@react-navigation/bottom-tabs` không resolve thẳng được trong workspace này
 * (nó nằm trong cây phụ thuộc của expo-router), mà tự thêm một bản sao thì có
 * nguy cơ nhân đôi react-navigation. TypeScript so khớp theo CẤU TRÚC nên props
 * thật vẫn gán được vào hình dạng này ở chỗ nối `tabBar` của expo-router.
 */
export interface FloatingTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
      };
    }
  >;
  navigation: {
    navigate: (name: string) => void;
    /**
     * Tập con của `emit` — cần để bấm lại tab ĐANG mở vẫn bắn `tabPress` (màn
     * dùng nó để cuộn lên đầu), thứ mà `navigate` trần sẽ nuốt vì điều hướng
     * tới chính route hiện tại là no-op.
     */
    emit: (event: { type: 'tabPress'; target?: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
  };
}

/** Chiều cao thanh điều hướng đáy chưa tính lề an toàn (N1, Material 3). */
export const TAB_BAR_HEIGHT = 80;

/** Bề ngang viên chỉ báo — 64 theo M3, đủ rộng để nhãn đậm không chạm mép. */
const INDICATOR_WIDTH = 64;

interface TabItemProps {
  name: string;
  label: string;
  focused: boolean;
  icon: ReactNode;
  onPress: () => void;
}

/**
 * Một tab của thanh. Viên chỉ báo luôn được vẽ (nền `secondary`) và đổi `progress` 0↔1:
 * mở từ giữa ra hai bên (scaleX) kèm hiện dần; icon nảy nhẹ khi vào tab. Chỉ dùng transform và
 * opacity nên chạy hết trên native driver, không gây layout lại.
 */
function TabItem({ name, label, focused, icon, onPress }: TabItemProps) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(1)).current;
  const color = focused ? theme.colors['secondary-foreground'] : theme.colors['muted-foreground'];

  useEffect(() => {
    // Lò xo thay cho tween: viên chỉ báo mở ra có đà rồi lắng, bấm đổi tab liên tục vẫn nối mượt.
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      stiffness: 300,
      damping: 26,
      mass: 1,
      useNativeDriver: true,
    }).start();
    if (focused) {
      bounce.setValue(0.8);
      Animated.spring(bounce, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [focused, progress, bounce]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
    >
      <View
        testID={`tab-icon-${name}`}
        style={{
          width: INDICATOR_WIDTH,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          testID={`tab-indicator-${name}`}
          style={{
            position: 'absolute',
            width: INDICATOR_WIDTH,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.colors.secondary,
            opacity: progress,
            transform: [
              {
                scaleX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                  extrapolate: 'clamp',
                }),
              },
            ],
          }}
        />
        <Animated.View style={{ transform: [{ scale: bounce }] }}>{icon}</Animated.View>
      </View>
      <AppText variant="caption" style={{ color, fontWeight: '500' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Thanh điều hướng đáy kiểu Material 3: tràn ngang, nền `surfaces.container` đục, mỗi tab là
 * viên chỉ báo 64×32 bo 16 (đang chọn: nền `secondary`, icon đặc) và nhãn 12 luôn hiện.
 *
 * Thanh nằm TRONG luồng bố cục của `Tabs` (không nổi) nên màn không phải chừa đáy. Bấm lại tab
 * đang mở vẫn bắn `tabPress` để màn cuộn lên đầu.
 */
export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        height: TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: theme.surfaces.container,
        // Vạch mảnh phân thanh với thân trang — nền tối hai bên gần cùng màu.
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key] ?? { options: {} };
        const color = focused
          ? theme.colors['secondary-foreground']
          : theme.colors['muted-foreground'];

        return (
          <TabItem
            key={route.key}
            name={route.name}
            label={options.title ?? route.name}
            focused={focused}
            icon={options.tabBarIcon?.({ focused, color, size: 24 })}
            onPress={() => {
              // Giống thanh tab mặc định của react-navigation: LUÔN bắn `tabPress`, chỉ bỏ
              // qua điều hướng khi tab tự xử lý (`defaultPrevented`) hoặc nó đang mở sẵn.
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}
