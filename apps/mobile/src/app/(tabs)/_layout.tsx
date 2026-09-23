import { messages } from '@tourism/i18n';
import { TabBarIcon, useTheme } from '@tourism/mobile-ui';
import { Tabs } from 'expo-router';

// Icon Feather cho 5 tab (handoff §T0) — khoá trùng tên route, trừ `index`
// (route gốc) tra nhãn bằng `tabs.home`.
const TAB_ICONS = {
  index: 'home',
  explore: 'compass',
  saved: 'heart',
  trips: 'briefcase',
  account: 'user',
} as const;

/**
 * Thanh 5 tab — xương lấy từ Nexora (luật 10: thứ Nexora có mà đây thiếu là
 * thụt lùi). Nhãn đọc từ `@tourism/i18n`, màu đọc từ `useTheme()`.
 *
 * P5b: gắn icon Feather qua `TabBarIcon` (viên nền `primary` khi đang chọn).
 */
export default function TabsLayout() {
  const theme = useTheme();
  const { tabs } = messages.mobile;

  return (
    <Tabs
      screenOptions={{
        // Tiêu đề nằm trong thân màn (`PlaceholderScreen`), không nhân đôi ở
        // header — P5b thiết kế header riêng cho từng màn.
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors['muted-foreground'],
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      {(Object.keys(TAB_ICONS) as (keyof typeof TAB_ICONS)[]).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: tabs[name === 'index' ? 'home' : name],
            tabBarIcon: ({ focused }) => <TabBarIcon name={TAB_ICONS[name]} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
