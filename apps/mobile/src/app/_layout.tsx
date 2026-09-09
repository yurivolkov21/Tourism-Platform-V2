import { messages } from '@tourism/i18n';
import { ThemeProvider, useTheme } from '@tourism/mobile-ui';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { env } from '@/lib/env';

// Giữ splash cho tới khi vỏ điều hướng dựng xong — tránh một nháy nền trắng
// trước khi màn đầu tiên kịp vẽ.
void SplashScreen.preventAutoHideAsync();

/**
 * Neo của stack gốc. KHÔNG có nó thì mở app bằng deep link (`nexora://tours/…`,
 * `nexora://login`) dựng ra một stack chỉ có ĐÚNG màn được trỏ tới: không nút
 * back, back cứng Android thoát thẳng app, không đường nào tới 5 tab.
 * `getRoutesCore` chỉ suy được anchor mặc định từ tên nhóm của layout, mà layout
 * gốc có `route === ''` nên suy ra `undefined` — phải khai tay.
 */
export const unstable_settings = { anchor: '(tabs)' };

/**
 * Stack gốc. Tách khỏi `RootLayout` vì `useTheme()` chỉ gọi được BÊN TRONG
 * `<ThemeProvider>` — cùng component thì hook chạy trước khi provider dựng.
 */
function RootStack() {
  const theme = useTheme();
  const { titles } = messages.mobile.appShell;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.foreground,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Nhóm auth mở dạng modal; header do stack bên trong nó vẽ. */}
      <Stack.Screen name="(auth)" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="tours/[slug]" options={{ title: titles.tourDetail }} />
      <Stack.Screen name="bookings/[code]" options={{ title: titles.bookingDetail }} />
      <Stack.Screen name="+not-found" options={{ title: titles.notFound }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Chạm `env` ở đây để lỗi THIẾU biến nổ ngay màn đầu tiên (ADR-0040 §9)
    // thay vì im lặng tới lúc có màn nào đó gọi API.
    void env.apiUrl;
    void SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <RootStack />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
