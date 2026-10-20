import { messages } from '@tourism/i18n';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';

/**
 * Bản build thiếu hay sai `EXPO_PUBLIC_*` (vd quên khai biến khi build APK):
 * `env()` ném ngay lần đầu `RootLayout` render. Hợp đồng ghi ở `_layout.tsx` và
 * `lib/env.ts`: ném TRONG cây React để `ErrorBoundary` gốc bắt — người dùng thấy
 * màn lỗi có chữ nêu đúng biến hỏng, và splash được gỡ. Dời `env()` ra module
 * scope là app đóng ngay lúc mở, trước khi có cây nào để bắt. Trước review M1
 * (20/10) hợp đồng này chưa có test nào canh.
 *
 * Giả `env()` ném đúng câu của `readEnv()` thật khi thiếu cả hai biến; mọi thứ
 * khác chạy thật. File riêng vì `jest.mock` áp cho cả file.
 */
jest.mock('@/lib/env', () => {
  const actual = jest.requireActual('@/lib/env');
  return { ...actual, env: () => actual.readEnv({}) };
});

// Bọc hàm thật để đếm lời gọi — gỡ splash là việc của `ErrorBoundary` gốc.
jest.mock('expo-splash-screen', () => {
  const actual = jest.requireActual('expo-splash-screen');
  return { ...actual, hideAsync: jest.fn(actual.hideAsync) };
});

it('thiếu biến env thì mở app ra màn lỗi nêu tên biến, và splash được gỡ', async () => {
  // React in lỗi mà ErrorBoundary bắt ra console — tắt cho output test sạch.
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const app = renderRouter('src/app', { initialUrl: '/' });
    await app;

    expect(screen.getByText(messages.mobile.appShell.crash.title)).toBeTruthy();
    expect(screen.getByText(/EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WEB_URL/)).toBeTruthy();
    expect(screen.getByText(messages.mobile.appShell.crash.retry)).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});
