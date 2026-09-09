import { messages } from '@tourism/i18n';
import { AppText, Button, EmptyState, Screen, ThemeProvider, useTheme } from '@tourism/mobile-ui';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
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

/**
 * Màn lỗi cuối cùng. Hai việc, và việc thứ hai mới là việc quan trọng:
 * 1. Cho người dùng một câu đọc được thay vì app tắt ngóm.
 * 2. GỠ SPLASH. `preventAutoHideAsync()` chạy vô điều kiện lúc nạp module, còn
 *    `hideAsync()` chỉ nằm trong effect của `RootLayout` — mà effect không bao
 *    giờ chạy nếu render ném. Không có dòng này thì mọi lỗi render là một màn
 *    splash đứng vĩnh viễn trong bản phát hành.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { crash } = messages.mobile.appShell;

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Screen>
          <AppText variant="title">{crash.title}</AppText>
          <EmptyState title={crash.body} body={error.message}>
            <Button label={crash.retry} onPress={() => void retry()} />
          </EmptyState>
        </Screen>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Gọi `env()` TRONG thân render (không phải trong effect): env nay ném lười,
  // và ném ở đây thì `ErrorBoundary` phía trên bắt được — người dùng thấy một
  // màn lỗi có chữ, thay vì app đóng ngay lúc mở như khi nó ném lúc nạp module.
  env();

  useEffect(() => {
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
