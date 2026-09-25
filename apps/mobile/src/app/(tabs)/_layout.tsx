import Feather from '@expo/vector-icons/Feather';
import { messages } from '@tourism/i18n';
import { FloatingTabBar, TAB_BAR_LIFT, TAB_BAR_TILE, useTheme } from '@tourism/mobile-ui';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Icon Feather cho 5 tab — khoá trùng tên route, trừ `index` (route gốc) tra
// nhãn bằng `tabs.home`.
const TAB_ICONS = {
  index: 'home',
  explore: 'compass',
  saved: 'heart',
  trips: 'briefcase',
  account: 'user',
} as const;

/**
 * Thanh 5 tab. Bố cục bê từ bản v1: thanh NỔI, không khung, icon trần, tab
 * đang chọn nằm trong ô vuông bo góc `primary` (`FloatingTabBar`). Vì thanh
 * nổi đè lên nội dung nên `sceneStyle.paddingBottom` phải chừa đúng chỗ cho
 * nó: lề dưới an toàn + khoảng hở + cạnh ô + một nhịp thở.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { tabs } = messages.mobile;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        // Tiêu đề nằm trong thân màn, không nhân đôi ở header — P5b thiết kế
        // header riêng cho từng màn.
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.colors.background,
          // Chỗ chừa = lề an toàn + phần nâng thanh + cạnh ô tab + NHỊP THỞ.
          // Nhịp thở giảm `spacing(8)`→`spacing(4)` (32→16dp) cùng lượt hạ chiều
          // cao thanh (phản hồi 24/09: thanh chiếm quá nhiều chiều dọc, nội dung
          // cần thêm chỗ). Vẫn hơn 12dp cũ vốn bị chê chật (23/09). Đặt ở đây nên
          // CẢ 5 tab có cùng khoảng hở, không màn nào phải tự nhớ chừa.
          paddingBottom: insets.bottom + TAB_BAR_LIFT + TAB_BAR_TILE + theme.spacing(4),
        },
      }}
    >
      {(Object.keys(TAB_ICONS) as (keyof typeof TAB_ICONS)[]).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: tabs[name === 'index' ? 'home' : name],
            tabBarIcon: ({ color, size }) => (
              <Feather name={TAB_ICONS[name]} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
