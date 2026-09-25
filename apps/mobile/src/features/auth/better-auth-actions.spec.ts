import { getAuthClient } from '@/lib/auth-client';
import { createBetterAuthActions } from './better-auth-actions';

// `getAuthClient()` giả — chỉ mock các nhánh mà `better-auth-actions.ts` thật
// sự gọi tới, cùng shape `{ data, error }` của @better-fetch (xem login-form.tsx
// của web, nguồn tham chiếu duy nhất cho shape này).
jest.mock('@/lib/auth-client', () => ({ getAuthClient: jest.fn() }));

const mockClient = {
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

  it('Google: lỗi qua mapAuthError, thành công thì ok:true', async () => {
    mockClient.signIn.social.mockResolvedValue({ data: null, error: { status: 404 } });
    await expect(actions.signInWithGoogle()).resolves.toEqual({
      ok: false,
      error: 'notAvailable',
    });

    mockClient.signIn.social.mockResolvedValue({ data: {}, error: null });
    await expect(actions.signInWithGoogle()).resolves.toEqual({ ok: true });
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
