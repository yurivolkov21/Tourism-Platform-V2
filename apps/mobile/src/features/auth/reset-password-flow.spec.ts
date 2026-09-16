import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { createMockAuthActions } from './mock-auth-actions';
import { submitResetPassword } from './reset-password-flow';

const actions: AuthActions = createMockAuthActions({ delayMs: 0 });
const valid = { token: 'tok', password: 'correct-horse', confirm: 'correct-horse' };

describe('submitResetPassword', () => {
  it('mật khẩu quá ngắn thì chặn ở máy, không gọi tới action', async () => {
    const resetPassword = jest.fn();

    const outcome = await submitResetPassword(
      { ...valid, password: 'abc', confirm: 'abc' },
      { ...actions, resetPassword },
    );

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { password: messages.formErrors.newPassword.tooShort },
    });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('xác nhận không khớp thì lỗi nằm ở ô confirm', async () => {
    const outcome = await submitResetPassword({ ...valid, confirm: 'correct-house' }, actions);

    expect(outcome).toMatchObject({
      kind: 'fieldErrors',
      errors: { confirm: messages.formErrors.confirmPassword.mismatch },
    });
  });

  it('token hỏng thì cả màn đổi trạng thái, không phải một câu lỗi', async () => {
    await expect(submitResetPassword({ ...valid, token: 'expired' }, actions)).resolves.toEqual({
      kind: 'invalidLink',
    });
  });

  it('lỗi khác token thì ra khung cấp form', async () => {
    const resetPassword = jest.fn().mockResolvedValue({ ok: false, error: 'tooManyRequests' });

    await expect(submitResetPassword(valid, { ...actions, resetPassword })).resolves.toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.tooManyRequests,
    });
  });

  it('đổi được thì báo xong', async () => {
    await expect(submitResetPassword(valid, actions)).resolves.toEqual({ kind: 'done' });
  });
});
