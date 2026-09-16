import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { createMockAuthActions } from './mock-auth-actions';
import { submitSignIn } from './sign-in-flow';

const actions: AuthActions = createMockAuthActions({ delayMs: 0 });

describe('submitSignIn', () => {
  it('ô trống thì chặn ngay ở máy, không gọi tới action', async () => {
    const signInWithEmail = jest.fn();

    const outcome = await submitSignIn(
      { email: '', password: '' },
      { ...actions, signInWithEmail },
    );

    expect(outcome).toMatchObject({ kind: 'fieldErrors' });
    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it('email sai định dạng cũng bị chặn ở máy', async () => {
    const outcome = await submitSignIn(
      { email: 'lan.nguyen@', password: 'correct-horse' },
      actions,
    );

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { email: messages.formErrors.email.invalid },
    });
  });

  it('sai thông tin đăng nhập ra khung cấp form, không gắn vào ô nào', async () => {
    const outcome = await submitSignIn(
      { email: 'lan@example.com', password: 'wrong-password' },
      actions,
    );

    expect(outcome).toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.invalidCredentials,
    });
  });

  it('email chưa xác minh là lệnh chuyển màn, không phải câu lỗi', async () => {
    const outcome = await submitSignIn(
      { email: 'unverified@example.com', password: 'correct-horse' },
      actions,
    );

    expect(outcome).toEqual({ kind: 'verifyEmail', email: 'unverified@example.com' });
  });

  it('đăng nhập được thì báo thành công', async () => {
    await expect(
      submitSignIn({ email: 'lan@example.com', password: 'correct-horse' }, actions),
    ).resolves.toEqual({ kind: 'success' });
  });
});
