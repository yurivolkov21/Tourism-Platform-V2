import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { submitForgotPassword } from './forgot-password-flow';
import { createMockAuthActions } from './mock-auth-actions';

const actions: AuthActions = createMockAuthActions({ delayMs: 0 });

describe('submitForgotPassword', () => {
  it('email sai định dạng thì chặn ở máy, không gọi tới action', async () => {
    const requestPasswordReset = jest.fn();

    const outcome = await submitForgotPassword('lan@', { ...actions, requestPasswordReset });

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { email: messages.formErrors.email.invalid },
    });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('email lạ vẫn báo đã gửi — API cố ý không nói email nào có tài khoản', async () => {
    await expect(submitForgotPassword('khong-ton-tai@example.com', actions)).resolves.toEqual({
      kind: 'sent',
    });
  });

  it('lỗi thật (quá nhiều lần) vẫn phải nói ra ở khung cấp form', async () => {
    const requestPasswordReset = jest
      .fn()
      .mockResolvedValue({ ok: false, error: 'tooManyRequests' });

    const outcome = await submitForgotPassword('lan@example.com', {
      ...actions,
      requestPasswordReset,
    });

    expect(outcome).toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.tooManyRequests,
    });
  });
});
