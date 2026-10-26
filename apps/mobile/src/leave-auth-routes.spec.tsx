import { act, waitFor } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { setPendingReturn } from '@/features/auth/return-to';
import { submitSignIn } from '@/features/auth/sign-in-flow';
import { onboardingStore } from '@/features/onboarding/onboarding-store';

/**
 * Rời nhóm auth trên CÂY ROUTE THẬT — thứ unit test của `leaveAuthTo` (router
 * giả) không thấy được: stack thật trông thế nào sau khi rời. Review 12/10 bắt
 * lỗi đúng ở khe đó: Sign in mở từ onboarding nằm lại dưới Home.
 *
 * File riêng vì cần đường vào LẦN ĐẦU (bản giả lập `onboardingStore` mặc định
 * "chưa xem", cùng lý do `onboarding-entry.spec.tsx`) và cần giả server auth.
 */

// Chỉ giả bước gọi server — form, route và điều hướng đều là code thật.
jest.mock('@/features/auth/sign-in-flow', () => ({
  ...jest.requireActual('@/features/auth/sign-in-flow'),
  submitSignIn: jest.fn(),
}));

const submitSignInMock = submitSignIn as jest.Mock;
const signIn = messages.mobile.auth.signIn;

beforeEach(() => {
  submitSignInMock.mockResolvedValue({ kind: 'success' });
});

/** Xem chú thích `openApp` ở `routes.spec.tsx`: trả object thường bọc kết quả. */
async function openApp(initialUrl: string) {
  const app = renderRouter('src/app', { initialUrl });
  await app;
  return { pathname: () => app.getPathname() };
}

/** Ô trống bị chặn ngay ở route (không gọi flow) — nhập đủ để lượt bấm đi tới `submitSignIn` (đã mock). */
async function fillSignIn() {
  await fireEvent.changeText(screen.getByPlaceholderText(signIn.email), 'lan@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText(signIn.password), 'correct-horse-1');
}

// Test này PHẢI chạy trước: nó cần `onboardingStore` còn "chưa xem".
it('lần đầu mở app, đăng nhập từ onboarding xong thì Sign in không nằm lại dưới Home', async () => {
  const app = await openApp('/');
  expect(app.pathname()).toBe('/onboarding');

  const onboarding = messages.mobile.onboarding;
  await fireEvent.press(screen.getByLabelText(onboarding.next));
  await fireEvent.press(screen.getByLabelText(onboarding.next));
  await fireEvent.press(screen.getByText(onboarding.haveAccount));
  await waitFor(() => expect(app.pathname()).toBe('/login'));

  await fillSignIn();
  await fireEvent.press(screen.getByText(signIn.submit));

  await waitFor(() => expect(app.pathname()).toBe('/'));
  // Còn đường lùi là Sign in còn nằm dưới — back cứng Android sẽ về lại nó.
  expect(router.canGoBack()).toBe(false);
});

// Dựng đúng hai lệnh của đường onboarding (`_layout` gốc rồi `onboarding.tsx`)
// thay vì bấm lại từng trang: lượt trước đã đánh dấu "đã xem".
async function openSignInFromOnboarding() {
  await onboardingStore.markSeen();
  const app = await openApp('/');
  await act(() => router.replace('/onboarding'));
  await act(() => router.replace('/login'));
  expect(app.pathname()).toBe('/login');
  return app;
}

it('bấm X ở Sign in mở từ onboarding thì về Home, không để lại Sign in', async () => {
  const app = await openSignInFromOnboarding();

  await fireEvent.press(screen.getByLabelText(messages.mobile.appShell.close));

  expect(app.pathname()).toBe('/');
  expect(router.canGoBack()).toBe(false);
});

// R3: trước đây `router.replace` dựng thêm một bản tour thay chỗ modal — phải
// back hai lần mới rời được tour.
it('đăng nhập từ tour xong thì về đúng tour đó, back một lần là về Home', async () => {
  await onboardingStore.markSeen();
  const app = await openApp('/tours/ha-giang-loop');
  setPendingReturn({ path: '/tours/ha-giang-loop' });
  await act(() => router.navigate('/login'));

  await fillSignIn();
  await fireEvent.press(screen.getByText(signIn.submit));
  await waitFor(() => expect(app.pathname()).toBe('/tours/ha-giang-loop'));

  await act(() => router.back());
  expect(app.pathname()).toBe('/');
});
