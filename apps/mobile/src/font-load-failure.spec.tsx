import { messages } from '@tourism/i18n';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';

/**
 * Font brand nạp lỗi — vd tunnel rớt giữa lúc tải 5 file font khi dev. `useFonts`
 * khi đó trả `[false, error]` mãi mãi: nếu layout chỉ chờ `loaded` thì splash
 * đứng vĩnh viễn, không màn lỗi nào, vì không có gì ném lên `ErrorBoundary`.
 * Giả lập đúng ở tầng hook của expo-font; mọi thứ khác chạy thật. File riêng vì
 * `jest.mock` áp cho cả file.
 */
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [false, new Error('Font tải thất bại')],
}));

// Bọc hàm thật để đếm lời gọi — gỡ splash là hợp đồng của layout gốc.
jest.mock('expo-splash-screen', () => {
  const actual = jest.requireActual('expo-splash-screen');
  return { ...actual, hideAsync: jest.fn(actual.hideAsync) };
});

it('font nạp lỗi thì app vẫn vẽ (bằng chữ hệ thống) và gỡ splash', async () => {
  const app = renderRouter('src/app', { initialUrl: '/' });
  await app;

  expect(app.getPathname()).toBe('/onboarding');
  expect(screen.getByText(messages.mobile.onboarding.pages[0]?.title ?? '')).toBeTruthy();
  expect(SplashScreen.hideAsync).toHaveBeenCalled();
});
