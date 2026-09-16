import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { createMockAuthActions } from './mock-auth-actions';
import { submitRegister } from './register-flow';

const actions: AuthActions = createMockAuthActions({ delayMs: 0 });
const valid = { name: 'Lan Nguyen', email: 'lan@example.com', password: 'correct-horse' };

describe('submitRegister', () => {
  it('thiếu tên thì chặn ở máy, không gọi tới action', async () => {
    const signUpWithEmail = jest.fn();

    const outcome = await submitRegister({ ...valid, name: '' }, { ...actions, signUpWithEmail });

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { name: messages.formErrors.name.required },
    });
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it('mật khẩu quá ngắn bị chặn ở máy', async () => {
    const outcome = await submitRegister({ ...valid, password: 'abc' }, actions);

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { password: messages.formErrors.password.tooShort },
    });
  });

  it('đăng ký xong dẫn sang màn xác minh email', async () => {
    await expect(submitRegister(valid, actions)).resolves.toEqual({
      kind: 'verifyEmail',
      email: valid.email,
    });
  });

  it('email đã có tài khoản vẫn dẫn sang màn xác minh — API cố ý không nói khác', async () => {
    await expect(
      submitRegister({ ...valid, email: 'unverified@example.com' }, actions),
    ).resolves.toEqual({ kind: 'verifyEmail', email: 'unverified@example.com' });
  });

  it('mất mạng thì ra khung cấp form', async () => {
    await expect(
      submitRegister({ ...valid, email: 'offline@example.com' }, actions),
    ).resolves.toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.generic,
    });
  });
});
