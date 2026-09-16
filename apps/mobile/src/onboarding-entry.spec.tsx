import { messages } from '@tourism/i18n';
import { renderRouter, screen } from 'expo-router/testing-library';

/**
 * Đường vào LẦN ĐẦU, tách thành file riêng: bản giả lập `onboardingStore` nhớ
 * trong RAM và mặc định là "chưa xem", mà `routes.spec.tsx` lại cần trạng thái
 * ngược lại. Jest chỉ cấp sổ module mới cho từng FILE, nên chỉ có tách file mới
 * giữ được cả hai mà không phải thêm API chỉ-dành-cho-test.
 */
it('mở app lần đầu thì vào thẳng onboarding, không nháy qua Home', async () => {
  const app = renderRouter('src/app', { initialUrl: '/' });
  await app;

  expect(app.getPathname()).toBe('/onboarding');
  expect(screen.getByText(messages.mobile.onboarding.pages[0]?.title ?? '')).toBeTruthy();
});
