import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withAlpha } from './theme';
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

/** Cạnh ô nền của tab đang chọn, cũng là vùng chạm của mỗi tab. */
export const TAB_BAR_TILE = 60;

/**
 * Khoảng NÂNG thanh tab khỏi mép dưới an toàn. Đủ để thanh đọc ra là "nổi"
 * trên nội dung chứ không dính đáy màn (dính đáy nhìn rất kì — phản hồi 23/09),
 * nhưng gọn lại (20→12, phản hồi 24/09: thanh chiếm quá nhiều chiều dọc). Màn
 * cộng số này vào `sceneStyle.paddingBottom` để nội dung không chui xuống thanh.
 */
export const TAB_BAR_LIFT = 12;

/**
 * Thanh tab KHÔNG khung — icon trần nổi trên nền trang, tab đang chọn nằm
 * trong một ô vuông bo góc màu `primary`. Phía sau có dải mờ chuyển dần về
 * màu nền để nội dung cuộn phía dưới không tranh chấp độ đọc với icon.
 *
 * Màn phải tự chừa chỗ cho thanh này (`sceneStyle.paddingBottom` ở `Tabs`).
 * Không có nhãn chữ: tên tab đi qua `accessibilityLabel` cho trình đọc màn hình.
 */
export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <>
      <LinearGradient
        testID="tabbar-fade"
        pointerEvents="none"
        colors={[withAlpha(theme.colors.background, 0), theme.colors.background]}
        locations={[0, 0.6]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: insets.bottom + TAB_BAR_TILE + theme.spacing(10),
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + TAB_BAR_LIFT,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: theme.spacing(6),
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key] ?? { options: {} };
          const color = focused
            ? theme.colors['primary-foreground']
            : theme.colors['muted-foreground'];

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={options.title ?? route.name}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                // Giống thanh tab mặc định của react-navigation: LUÔN bắn
                // `tabPress`, chỉ bỏ qua điều hướng khi tab tự xử lý
                // (`defaultPrevented`) hoặc nó đang mở sẵn.
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{
                width: TAB_BAR_TILE,
                height: TAB_BAR_TILE,
                borderRadius: theme.radius.base * 3,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? theme.colors.primary : 'transparent',
              }}
            >
              <View testID={`tab-icon-${route.name}`} style={{ opacity: focused ? 1 : 0.75 }}>
                {options.tabBarIcon?.({ focused, color, size: focused ? 26 : 24 })}
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
