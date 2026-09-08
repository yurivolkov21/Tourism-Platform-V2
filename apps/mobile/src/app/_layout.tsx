import { ThemeProvider } from '@tourism/mobile-ui';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { env } from '@/lib/env';

// Giữ splash cho tới khi vỏ điều hướng dựng xong — tránh một nháy nền trắng
// trước khi màn đầu tiên kịp vẽ.
void SplashScreen.preventAutoHideAsync();

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
        <Stack />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
