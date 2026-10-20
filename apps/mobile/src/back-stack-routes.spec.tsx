import { act, waitFor } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { submitForgotPassword } from '@/features/auth/forgot-password-flow';
import { onboardingStore } from '@/features/onboarding/onboarding-store';
import { deleteAccountRequest } from '@/lib/account-api';

/**
 * Nút "về" của từng màn, chạy trên CÂY ROUTE THẬT: về xong thì stack không được
 * giữ bản sao nào của màn đích. `router.replace` thay màn hiện tại bằng một bản
 * MỚI của màn đích kể cả khi màn đích đang nằm ngay dưới (Sign in chồng Sign in,
 * bộ tab chồng bộ tab), nên back một lần lại về đúng chỗ khách vừa rời — review
 * M1 (20/10). `router.dismissTo` gỡ về bản đang có, chưa có thì thay màn hiện
 * tại.
 *
 * File riêng vì phải giả hai bước gọi server (gửi link quên mật khẩu, xoá tài
 * khoản); `jest.mock` áp cho cả file.
 */

// Chỉ giả bước gọi server — form, route và điều hướng đều là code thật.
jest.mock('@/features/auth/forgot-password-flow', () => ({
  ...jest.requireActual('@/features/auth/forgot-password-flow'),
  submitForgotPassword: jest.fn(),
}));
jest.mock('@/lib/account-api', () => ({
  ...jest.requireActual('@/lib/account-api'),
  deleteAccountRequest: jest.fn(),
}));

const submitForgotPasswordMock = submitForgotPassword as jest.Mock;
const deleteAccountRequestMock = deleteAccountRequest as jest.Mock;
const auth = messages.mobile.auth;
const shell = messages.mobile.appShell;

// Mọi test mô phỏng người ĐÃ xem onboarding — xem chú thích cùng chỗ ở `routes.spec.tsx`.
beforeEach(async () => {
  await onboardingStore.markSeen();
  submitForgotPasswordMock.mockResolvedValue({ kind: 'sent' });
  deleteAccountRequestMock.mockResolvedValue({ ok: true });
});

type App = { pathname: () => string };

/** Xem chú thích `openApp` ở `routes.spec.tsx`: trả object thường bọc kết quả. */
async function openApp(initialUrl: string): Promise<App> {
  const app = renderRouter('src/app', { initialUrl });
  await app;
  return { pathname: () => app.getPathname() };
}

/** Sign in mở từ Home — cùng lệnh mà cổng đăng nhập của các tab gọi. */
async function openSignIn(): Promise<App> {
  const app = await openApp('/');
  await act(() => router.navigate('/login'));
  expect(app.pathname()).toBe('/login');
  return app;
}

/**
 * Màn nằm dưới vẫn còn trong cây, và chữ nút của nó có thể trùng chữ nút cần
 * bấm ở màn trên: "Sign in" là nút gửi của Sign in, cũng là link ở Create
 * account và nút ở màn kết quả. Stack vẽ màn theo thứ tự nên bản CUỐI thuộc màn
 * trên cùng.
 */
function topmostText(text: string) {
  const match = screen.getAllByText(text).at(-1);
  if (match === undefined) throw new Error(`Không thấy "${text}"`);
  return match;
}

/** Sign in phải là màn DUY NHẤT còn trong nhóm auth: back một lần là đóng cả nhóm. */
async function expectBackClosesAuth(app: App) {
  await act(() => router.back());
  expect(app.pathname()).toBe('/');
}

describe('về Sign in từ trong nhóm auth', () => {
  it('"Back to sign in" ở Forgot password về lại đúng Sign in đang nằm dưới', async () => {
    const app = await openSignIn();
    await fireEvent.press(screen.getByText(auth.signIn.forgot));
    await fireEvent.press(screen.getByText(messages.authForms.forgotPassword.submit));

    await fireEvent.press(screen.getByText(auth.forgotPassword.backToSignIn));

    expect(app.pathname()).toBe('/login');
    await expectBackClosesAuth(app);
  });

  it('"Sign in" ở Create account về lại Sign in đang nằm dưới, không đẻ thêm bản', async () => {
    const app = await openSignIn();
    await fireEvent.press(screen.getByText(auth.signIn.footerAction));
    expect(app.pathname()).toBe('/register');

    await fireEvent.press(topmostText(auth.register.footerAction));

    expect(app.pathname()).toBe('/login');
    await expectBackClosesAuth(app);
  });

  // Đường Sign in → Verify (tài khoản chưa xác minh) → kết quả. Dựng bằng đúng
  // lệnh của `login.tsx` và `verify-email.tsx` thay vì gõ mã qua server giả.
  it('"Sign in" ở màn kết quả sau xác minh email về lại Sign in gốc', async () => {
    const app = await openSignIn();
    await act(() =>
      router.push({
        pathname: '/verify-email',
        params: { email: 'lan@example.com', reason: 'blocked' },
      }),
    );
    await act(() => router.replace({ pathname: '/success', params: { kind: 'verified' } }));
    expect(app.pathname()).toBe('/success');

    await fireEvent.press(topmostText(auth.success.signIn));

    expect(app.pathname()).toBe('/login');
    await expectBackClosesAuth(app);
  });

  // Nhánh còn lại của `dismissTo`: đặt lại mật khẩu mở từ link email nên trong
  // nhóm chưa có Sign in nào — màn kết quả phải được THAY bằng Sign in, không
  // được đóng luôn cả nhóm auth.
  it('"Sign in" ở màn kết quả sau đặt lại mật khẩu (mở từ email) vẫn ra Sign in', async () => {
    const app = await openApp('/reset-password?token=abc');
    await act(() => router.replace({ pathname: '/success', params: { kind: 'password-updated' } }));

    await fireEvent.press(screen.getByText(auth.success.signIn));

    expect(app.pathname()).toBe('/login');
    await expectBackClosesAuth(app);
  });
});

describe('về Home', () => {
  it('X ở Reset password (mở từ link trong email) về Home, không đẻ thêm bộ tab', async () => {
    const app = await openApp('/reset-password?token=abc');

    await fireEvent.press(screen.getByLabelText(shell.close));

    expect(app.pathname()).toBe('/');
    expect(router.canGoBack()).toBe(false);
  });

  it('nút về ở +not-found về Home, không đẻ thêm bộ tab', async () => {
    const app = await openApp('/khong-ton-tai');

    await fireEvent.press(screen.getByText(shell.notFound.back));

    expect(app.pathname()).toBe('/');
    expect(router.canGoBack()).toBe(false);
  });

  it('xoá tài khoản xong về Home, back không quay lại bộ tab cũ đang mở Account', async () => {
    const app = await openApp('/account');
    await act(() => router.push('/personal-details'));
    const details = messages.mobile.account.personalDetails;
    await fireEvent.press(screen.getByText(details.deleteAccount));
    await fireEvent.changeText(
      screen.getByLabelText(messages.mobile.account.password.currentLabel),
      'correct-horse',
    );

    // Nút xác nhận trong tấm A7 trùng chữ dòng "Delete account" của màn.
    await fireEvent.press(topmostText(details.deleteAccount));

    await waitFor(() => expect(app.pathname()).toBe('/'));
    expect(router.canGoBack()).toBe(false);
  });
});

// Ghi cờ "đã xem" hỏng (Keychain đang khoá, keystore Android hỏng) — cùng loại
// lỗi mà `readHasSeen` (F9) đã chặn ở chiều đọc. Không chặn thì mọi nút của
// onboarding bấm không đi đâu và khách kẹt ở ba trang giới thiệu.
it('ghi cờ onboarding hỏng thì Skip vẫn đưa khách vào app', async () => {
  const app = await openApp('/');
  await act(() => router.replace('/onboarding'));
  const markSeen = jest
    .spyOn(onboardingStore, 'markSeen')
    .mockRejectedValueOnce(new Error('keystore hỏng'));

  try {
    await fireEvent.press(screen.getByText(messages.mobile.onboarding.skip));

    await waitFor(() => expect(app.pathname()).toBe('/'));
    expect(markSeen).toHaveBeenCalledTimes(1);
  } finally {
    markSeen.mockRestore();
  }
});
