import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { messages } from '@tourism/i18n';
import { FloatingTabBar, useTheme } from '@tourism/mobile-ui';
import { Tabs } from 'expo-router';

// Cặp icon Material (đặc khi chọn, viền khi không) cho 5 tab — khoá trùng tên route, trừ
// `index` (route gốc) tra nhãn bằng `tabs.home`.
const TAB_ICONS = {
  index: { on: 'home', off: 'home-outline' },
  explore: { on: 'compass', off: 'compass-outline' },
  saved: { on: 'heart', off: 'heart-outline' },
  trips: { on: 'briefcase', off: 'briefcase-outline' },
  account: { on: 'account', off: 'account-outline' },
} as const;

/**
 * Thanh 5 tab kiểu Material 3 (N1). `FloatingTabBar` nằm trong luồng bố cục nên
 * `sceneStyle` không cần chừa đáy.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const { tabs } = messages.mobile;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        // Tiêu đề nằm trong thân màn, không nhân đôi ở header.
        headerShown: false,
        // Tab đang ẩn ngừng render lại, đỡ tốn pin; quay lại là chạy tiếp.
        freezeOnBlur: true,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {(Object.keys(TAB_ICONS) as (keyof typeof TAB_ICONS)[]).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: tabs[name === 'index' ? 'home' : name],
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialCommunityIcons
                name={focused ? TAB_ICONS[name].on : TAB_ICONS[name].off}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
