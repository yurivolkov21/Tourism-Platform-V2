import { messages } from '@tourism/i18n';
import { useTheme } from '@tourism/mobile-ui';
import { Tabs } from 'expo-router';

/**
 * Thanh 5 tab — xương lấy từ Nexora (luật 10: thứ Nexora có mà đây thiếu là
 * thụt lùi). Nhãn đọc từ `@tourism/i18n`, màu đọc từ `useTheme()`.
 *
 * Chưa có icon: template P5a cố ý không cài `expo-symbols` hay bộ icon nào
 * (spec §4.2) — P5b gắn icon cùng lúc với nội dung màn.
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
      <Tabs.Screen name="index" options={{ title: tabs.home }} />
      <Tabs.Screen name="explore" options={{ title: tabs.explore }} />
      <Tabs.Screen name="saved" options={{ title: tabs.saved }} />
      <Tabs.Screen name="trips" options={{ title: tabs.trips }} />
      <Tabs.Screen name="account" options={{ title: tabs.account }} />
    </Tabs>
  );
}
