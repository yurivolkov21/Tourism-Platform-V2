import { messages } from '@tourism/i18n';
import { type ChangePasswordAction, submitChangePassword } from './change-password-flow';

const valid = {
  currentPassword: 'old-password',
  newPassword: 'new-password-1',
  confirmPassword: 'new-password-1',
};

const okAction: ChangePasswordAction = jest.fn().mockResolvedValue({ ok: true });

describe('submitChangePassword', () => {
  it('thiếu ô hiện tại thì chặn ở máy, không gọi action', async () => {
    const changePassword = jest.fn();

    const outcome = await submitChangePassword({ ...valid, currentPassword: '' }, changePassword);

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { currentPassword: messages.formErrors.currentPassword.required },
    });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('mật khẩu mới quá ngắn thì chặn ở máy', async () => {
    const outcome = await submitChangePassword(
      { ...valid, newPassword: 'abc', confirmPassword: 'abc' },
      okAction,
    );

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { newPassword: messages.formErrors.newPassword.tooShort },
    });
  });

  it('xác nhận không khớp thì lỗi nằm ở ô confirmPassword', async () => {
    const outcome = await submitChangePassword(
      { ...valid, confirmPassword: 'khac-hoan-toan' },
      okAction,
    );

    expect(outcome).toMatchObject({
      kind: 'fieldErrors',
      errors: { confirmPassword: messages.formErrors.confirmPassword.mismatch },
    });
  });

  it('mật khẩu hiện tại sai (server) thì gắn vào đúng ô đầu', async () => {
    const changePassword: ChangePasswordAction = jest
      .fn()
      .mockResolvedValue({ ok: false, error: 'wrongCurrentPassword' });

    await expect(submitChangePassword(valid, changePassword)).resolves.toEqual({
      kind: 'fieldErrors',
      errors: { currentPassword: messages.authForms.errors.wrongCurrentPassword },
    });
  });

  it('lỗi khác (kể cả lỗi quy được về "ô mật khẩu") rơi về khung cấp form, không tự map field', async () => {
    const changePassword: ChangePasswordAction = jest
      .fn()
      .mockResolvedValue({ ok: false, error: 'passwordTooShort' });

    await expect(submitChangePassword(valid, changePassword)).resolves.toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.passwordTooShort,
    });
  });

  it('mạng đứt/lỗi chung cũng rơi về khung cấp form', async () => {
    const changePassword: ChangePasswordAction = jest
      .fn()
      .mockResolvedValue({ ok: false, error: 'generic' });

    await expect(submitChangePassword(valid, changePassword)).resolves.toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.generic,
    });
  });

  it('đổi được thì báo xong, truyền ĐÚNG currentPassword/newPassword cho action', async () => {
    const changePassword = jest.fn().mockResolvedValue({ ok: true });

    await expect(submitChangePassword(valid, changePassword)).resolves.toEqual({ kind: 'done' });
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: valid.currentPassword,
      newPassword: valid.newPassword,
    });
  });
});
