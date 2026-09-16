import { createMockAuthActions } from './mock-auth-actions';

// Bảng kịch bản của spec P5b-1 §6: bản giả lập phải bấm ra được TỪNG nhánh lỗi
// trên máy thật, không cần API.
const actions = createMockAuthActions({ delayMs: 0 });

describe('bản giả lập AuthActions — đăng nhập', () => {
  it.each([
    ['unverified@example.com', 'correct-horse', 'emailNotVerified'],
    ['lan@example.com', 'wrong-password', 'invalidCredentials'],
    ['busy@example.com', 'correct-horse', 'tooManyRequests'],
    ['offline@example.com', 'correct-horse', 'generic'],
  ])('%s + %s trả lỗi %s', async (email, password, error) => {
    await expect(actions.signInWithEmail({ email, password })).resolves.toEqual({
      ok: false,
      error,
    });
  });

  it('thông tin hợp lệ thì thành công', async () => {
    await expect(
      actions.signInWithEmail({ email: 'lan@example.com', password: 'correct-horse' }),
    ).resolves.toEqual({ ok: true });
  });

  it('Google chưa bật', async () => {
    await expect(actions.signInWithGoogle()).resolves.toEqual({
      ok: false,
      error: 'notAvailable',
    });
  });
});

describe('bản giả lập AuthActions — đăng ký và xác minh', () => {
  it('đăng ký luôn thành công, kể cả email đã có tài khoản (API cố ý che)', async () => {
    await expect(
      actions.signUpWithEmail({
        name: 'Lan Nguyen',
        email: 'unverified@example.com',
        password: 'correct-horse',
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('mã 000000 là mã sai, mã khác thì xác minh xong', async () => {
    await expect(actions.verifyEmail({ email: 'lan@example.com', otp: '000000' })).resolves.toEqual(
      { ok: false, error: 'invalidOtp' },
    );
    await expect(actions.verifyEmail({ email: 'lan@example.com', otp: '482190' })).resolves.toEqual(
      { ok: true },
    );
  });

  it('gửi lại mã luôn thành công', async () => {
    await expect(actions.resendVerificationCode({ email: 'lan@example.com' })).resolves.toEqual({
      ok: true,
    });
  });
});

describe('bản giả lập AuthActions — quên và đặt lại mật khẩu', () => {
  it('quên mật khẩu luôn báo thành công, kể cả email lạ', async () => {
    await expect(
      actions.requestPasswordReset({ email: 'khong-ton-tai@example.com' }),
    ).resolves.toEqual({ ok: true });
  });

  it('token expired là link hỏng, token khác thì đổi được mật khẩu', async () => {
    await expect(
      actions.resetPassword({ token: 'expired', newPassword: 'correct-horse' }),
    ).resolves.toEqual({ ok: false, error: 'invalidToken' });
    await expect(
      actions.resetPassword({ token: 'fresh-token', newPassword: 'correct-horse' }),
    ).resolves.toEqual({ ok: true });
  });
});

describe('bản giả lập AuthActions — độ trễ', () => {
  it('mặc định có trễ để thấy được trạng thái đang gửi', async () => {
    jest.useFakeTimers();
    const slow = createMockAuthActions();
    const pending = slow.requestPasswordReset({ email: 'lan@example.com' });
    let done = false;
    void pending.then(() => {
      done = true;
    });

    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(600);
    await pending;
    expect(done).toBe(true);
    jest.useRealTimers();
  });
});
