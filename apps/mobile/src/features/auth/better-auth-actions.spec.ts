import { getAuthClient } from '@/lib/auth-client';
import { createBetterAuthActions } from './better-auth-actions';
import { loadGoogleSdk, requestGoogleIdToken } from './google-native';

// `getAuthClient()` giả — chỉ mock các nhánh mà `better-auth-actions.ts` thật
// sự gọi tới, cùng shape `{ data, error }` của @better-fetch (xem login-form.tsx
// của web, nguồn tham chiếu duy nhất cho shape này).
jest.mock('@/lib/auth-client', () => ({ getAuthClient: jest.fn() }));

// ADR-0056: seam SDK Google gốc — test không chạm module native.
jest.mock('./google-native', () => ({
  loadGoogleSdk: jest.fn(),
  requestGoogleIdToken: jest.fn(),
}));
jest.mock('@/lib/env', () => ({
  env: () => ({
    apiUrl: 'http://localhost:3001',
    webUrl: 'http://localhost:3000',
    google: { webClientId: 'web.apps.googleusercontent.com', iosClientId: undefined },
  }),
}));

const FAKE_SDK = { GoogleSignin: {}, statusCodes: {} };

const mockClient = {
  getSession: jest.fn(),
  signIn: { email: jest.fn(), social: jest.fn() },
  signUp: { email: jest.fn() },
  emailOtp: { verifyEmail: jest.fn(), sendVerificationOtp: jest.fn() },
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
};

(getAuthClient as jest.Mock).mockReturnValue(mockClient);

const actions = createBetterAuthActions();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('bản thật AuthActions — đăng nhập', () => {
  it('thành công thì ok:true', async () => {
    mockClient.signIn.email.mockResolvedValue({ data: {}, error: null });
    await expect(
      actions.signInWithEmail({ email: 'lan@example.com', password: 'correct-horse' }),
    ).resolves.toEqual({ ok: true });
  });

  it('EMAIL_NOT_VERIFIED là lệnh chuyển màn, không phải lỗi chung — và bắn lại OTP', async () => {
    mockClient.signIn.email.mockResolvedValue({
      data: null,
      error: { status: 403, code: 'EMAIL_NOT_VERIFIED' },
    });
    mockClient.emailOtp.sendVerificationOtp.mockResolvedValue({ data: {}, error: null });

    await expect(
      actions.signInWithEmail({ email: 'lan@example.com', password: 'correct-horse' }),
    ).resolves.toEqual({ ok: false, error: 'emailNotVerified' });
    expect(mockClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: 'lan@example.com',
      type: 'email-verification',
    });
  });

  it('401 đi qua mapAuthError thành invalidCredentials', async () => {
    mockClient.signIn.email.mockResolvedValue({ data: null, error: { status: 401 } });
    await expect(
      actions.signInWithEmail({ email: 'lan@example.com', password: 'wrong' }),
    ).resolves.toEqual({ ok: false, error: 'invalidCredentials' });
  });

  it('fetch ném (mạng đứt) trả generic, không rơi thành reject', async () => {
    mockClient.signIn.email.mockRejectedValue(new Error('network down'));
    await expect(
      actions.signInWithEmail({ email: 'lan@example.com', password: 'x' }),
    ).resolves.toEqual({ ok: false, error: 'generic' });
  });

  // ADR-0056 §1: app lấy ID token bằng SDK gốc rồi đổi lấy phiên — không mở
  // trình duyệt, không redirect, không hỏi lại phiên như luồng F12 cũ.
  it('Google: gửi đúng body idToken, không callbackURL, thành công thì ok:true', async () => {
    (loadGoogleSdk as jest.Mock).mockReturnValue(FAKE_SDK);
    (requestGoogleIdToken as jest.Mock).mockResolvedValue({ kind: 'token', idToken: 'jwt-1' });
    mockClient.signIn.social.mockResolvedValue({ data: { redirect: false }, error: null });

    await expect(actions.signInWithGoogle()).resolves.toEqual({ ok: true });
    expect(requestGoogleIdToken).toHaveBeenCalledWith(FAKE_SDK, {
      webClientId: 'web.apps.googleusercontent.com',
      iosClientId: undefined,
    });
    expect(mockClient.signIn.social).toHaveBeenCalledWith({
      provider: 'google',
      idToken: { token: 'jwt-1' },
    });
    expect(mockClient.getSession).not.toHaveBeenCalled();
  });

  it('Google: API 401 (token bị từ chối) thành lỗi chung, không phải "sai mật khẩu"', async () => {
    (loadGoogleSdk as jest.Mock).mockReturnValue(FAKE_SDK);
    (requestGoogleIdToken as jest.Mock).mockResolvedValue({ kind: 'token', idToken: 'jwt-1' });
    mockClient.signIn.social.mockResolvedValue({
      data: null,
      error: { status: 401, code: 'INVALID_TOKEN' },
    });

    await expect(actions.signInWithGoogle()).resolves.toEqual({ ok: false, error: 'generic' });
  });

  it('Google: lỗi khác của API vẫn đi qua mapAuthError', async () => {
    (loadGoogleSdk as jest.Mock).mockReturnValue(FAKE_SDK);
    (requestGoogleIdToken as jest.Mock).mockResolvedValue({ kind: 'token', idToken: 'jwt-1' });
    mockClient.signIn.social.mockResolvedValue({ data: null, error: { status: 404 } });

    await expect(actions.signInWithGoogle()).resolves.toEqual({
      ok: false,
      error: 'notAvailable',
    });
  });

  it('Google: khách đóng bảng chọn tài khoản thì cancelled, không gọi API', async () => {
    (loadGoogleSdk as jest.Mock).mockReturnValue(FAKE_SDK);
    (requestGoogleIdToken as jest.Mock).mockResolvedValue({ kind: 'cancelled' });

    await expect(actions.signInWithGoogle()).resolves.toEqual({
      ok: false,
      error: 'cancelled',
    });
    expect(mockClient.signIn.social).not.toHaveBeenCalled();
  });

  it('Google: lỗi của SDK gốc thành generic, không gọi API', async () => {
    (loadGoogleSdk as jest.Mock).mockReturnValue(FAKE_SDK);
    (requestGoogleIdToken as jest.Mock).mockResolvedValue({ kind: 'error', code: 'unknown' });

    await expect(actions.signInWithGoogle()).resolves.toEqual({ ok: false, error: 'generic' });
    expect(mockClient.signIn.social).not.toHaveBeenCalled();
  });

  it('Google: không có module native (Expo Go) thì notAvailable', async () => {
    (loadGoogleSdk as jest.Mock).mockReturnValue(null);

    await expect(actions.signInWithGoogle()).resolves.toEqual({
      ok: false,
      error: 'notAvailable',
    });
    expect(requestGoogleIdToken).not.toHaveBeenCalled();
  });

  it('Google: mạng đứt lúc đổi token lấy phiên thì generic, không reject', async () => {
    (loadGoogleSdk as jest.Mock).mockReturnValue(FAKE_SDK);
    (requestGoogleIdToken as jest.Mock).mockResolvedValue({ kind: 'token', idToken: 'jwt-1' });
    mockClient.signIn.social.mockRejectedValue(new Error('network down'));

    await expect(actions.signInWithGoogle()).resolves.toEqual({ ok: false, error: 'generic' });
  });
});

describe('bản thật AuthActions — đăng ký và xác minh', () => {
  it('signUpWithEmail chuyển tiếp lỗi/thành công qua mapAuthError', async () => {
    mockClient.signUp.email.mockResolvedValue({ data: null, error: { code: 'EXISTS' } });
    await expect(
      actions.signUpWithEmail({ name: 'Lan', email: 'lan@example.com', password: 'x' }),
    ).resolves.toEqual({ ok: false, error: 'emailExists' });

    mockClient.signUp.email.mockResolvedValue({ data: {}, error: null });
    await expect(
      actions.signUpWithEmail({ name: 'Lan', email: 'lan@example.com', password: 'x' }),
    ).resolves.toEqual({ ok: true });
  });

  it('verifyEmail: mã sai qua mapAuthError, mã đúng thì ok:true', async () => {
    mockClient.emailOtp.verifyEmail.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_OTP' },
    });
    await expect(actions.verifyEmail({ email: 'lan@example.com', otp: '000000' })).resolves.toEqual(
      { ok: false, error: 'invalidOtp' },
    );

    mockClient.emailOtp.verifyEmail.mockResolvedValue({ data: {}, error: null });
    await expect(actions.verifyEmail({ email: 'lan@example.com', otp: '482190' })).resolves.toEqual(
      { ok: true },
    );
  });

  it('resendVerificationCode chuyển tiếp lỗi/thành công', async () => {
    mockClient.emailOtp.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 429 },
    });
    await expect(actions.resendVerificationCode({ email: 'lan@example.com' })).resolves.toEqual({
      ok: false,
      error: 'tooManyRequests',
    });
  });
});

describe('bản thật AuthActions — quên và đặt lại mật khẩu', () => {
  it('requestPasswordReset luôn ok:true kể cả server nói lỗi (chống dò tài khoản)', async () => {
    mockClient.requestPasswordReset.mockResolvedValue({ data: null, error: { status: 404 } });
    await expect(
      actions.requestPasswordReset({ email: 'khong-ton-tai@example.com' }),
    ).resolves.toEqual({ ok: true });
  });

  it('requestPasswordReset: mạng đứt thật thì mới generic', async () => {
    mockClient.requestPasswordReset.mockRejectedValue(new Error('network down'));
    await expect(actions.requestPasswordReset({ email: 'lan@example.com' })).resolves.toEqual({
      ok: false,
      error: 'generic',
    });
  });

  it('resetPassword chuyển tiếp lỗi/thành công', async () => {
    mockClient.resetPassword.mockResolvedValue({ data: null, error: { code: 'INVALID_TOKEN' } });
    await expect(
      actions.resetPassword({ token: 'expired', newPassword: 'correct-horse' }),
    ).resolves.toEqual({ ok: false, error: 'invalidToken' });

    mockClient.resetPassword.mockResolvedValue({ data: {}, error: null });
    await expect(
      actions.resetPassword({ token: 'fresh-token', newPassword: 'correct-horse' }),
    ).resolves.toEqual({ ok: true });
  });
});
