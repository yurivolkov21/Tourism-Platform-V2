import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from '@expo-google-fonts/archivo';
import { Literata_700Bold } from '@expo-google-fonts/literata';
import { QueryClientProvider } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { AppText, Button, EmptyState, Screen, ThemeProvider, useTheme } from '@tourism/mobile-ui';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps, router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthActionsProvider } from '@/features/auth/auth-actions';
import { createMockAuthActions } from '@/features/auth/mock-auth-actions';
import { OnboardingStoreProvider, onboardingStore } from '@/features/onboarding/onboarding-store';
import { queryClient } from '@/lib/api/query-client';
import { env } from '@/lib/env';

// Giữ splash cho tới khi vỏ điều hướng dựng xong — tránh một nháy nền trắng
// trước khi màn đầu tiên kịp vẽ.
void SplashScreen.preventAutoHideAsync();

/**
 * Hạ tầng auth của đợt P5b-1: bản GIẢ LẬP. Dựng một lần ở module scope chứ không
 * trong thân render — dựng lại mỗi lần render là mỗi lần đổi identity của
 * context, kéo theo toàn bộ cây con vẽ lại.
 *
 * Người làm hạ tầng đổi đúng dòng này sang bản `@better-auth/expo` thật.
 */
const authActions = createMockAuthActions();

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
      {/* Onboarding phủ toàn màn và tự vẽ mọi thứ của nó. */}
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      {/* Nhóm dev cũng vậy: thiếu dòng này thì stack gốc đội cho nó một header
          tên "dev", và mọi khung trong gallery bị đo trong một khung ngắn hơn
          màn thật. */}
      <Stack.Screen name="dev" options={{ headerShown: false }} />
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

  // Bộ chữ brand giống web: Literata cho tiêu đề, Archivo cho chữ thân (ADR-0040
  // §AMEND 1). Mỗi độ đậm là một khuôn riêng vì `AppText` chọn family thay vì đặt
  // `fontWeight`.
  const [fontsLoaded, fontError] = useFonts({
    Literata_700Bold,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
  });
  // Nạp LỖI cũng tính là xong: vẽ bằng chữ hệ thống còn hơn splash đứng vĩnh
  // viễn — lỗi nạp font không ném gì lên `ErrorBoundary` để nó gỡ splash hộ.
  const fontsReady = fontsLoaded || fontError !== null;

  // Cờ "đã xem onboarding" đọc MỘT lần lúc mở app. Chưa xem thì thay màn ngay,
  // không đẩy thêm một bước vào stack: onboarding không phải chỗ để lùi về.
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    // Đợi có cây thật rồi mới đổi màn: `router.replace` gọi lúc cây còn `null`
    // là gọi khi chưa có navigator nào mounted.
    if (!fontsReady) return;

    let cancelled = false;

    void onboardingStore.hasSeen().then((seen) => {
      if (cancelled) return;
      if (!seen) router.replace('/onboarding');
      setOnboardingChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [fontsReady]);

  // Splash chỉ gỡ khi xong CẢ font lẫn cờ onboarding — không ai kịp thấy một
  // nháy Home trước khi nhảy sang onboarding.
  useEffect(() => {
    if (fontsReady && onboardingChecked) void SplashScreen.hideAsync();
  }, [fontsReady, onboardingChecked]);

  // CHƯA có font thì chưa vẽ gì. Vẽ bằng chữ hệ thống rồi đổi sang chữ brand làm
  // BỐ CỤC đo xong bằng khuôn cũ: đo trên máy 16/09, "Skip" ra "Ski" ở trang
  // onboarding và chỉ đúng lại sau khi reload (lần hai font đã nằm trong cache).
  // Splash vẫn đang che nên quãng chờ này không ai thấy.
  if (!fontsReady) return null;

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthActionsProvider value={authActions}>
          <QueryClientProvider client={queryClient}>
            <OnboardingStoreProvider value={onboardingStore}>
              <StatusBar style="auto" />
              <RootStack />
            </OnboardingStoreProvider>
          </QueryClientProvider>
        </AuthActionsProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
