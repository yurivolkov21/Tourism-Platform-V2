import { screen, userEvent } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { ResetPasswordScreen, type ResetPasswordScreenProps } from './reset-password-screen';

const copy = messages.mobile.auth.resetPassword;

const base: ResetPasswordScreenProps = {
  values: { password: '', confirm: '' },
  fieldErrors: {},
  formMessage: null,
  pending: false,
  invalidLink: false,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  onRequestNewLink: jest.fn(),
  onClose: jest.fn(),
};

describe('ResetPasswordScreen', () => {
  it('khung 5c — hai ô mật khẩu và nút ghim đáy', async () => {
    await renderWithTheme(<ResetPasswordScreen {...base} />, 'dark');

    expect(screen.getByPlaceholderText(copy.newPassword)).toBeTruthy();
    expect(screen.getByPlaceholderText(copy.confirmPassword)).toBeTruthy();
    expect(screen.getByText(copy.submit)).toBeTruthy();
  });

  it('khung 5c — lỗi lệch xác nhận nằm dưới ô confirm', async () => {
    await renderWithTheme(
      <ResetPasswordScreen
        {...base}
        values={{ password: 'correct-horse', confirm: 'correct-house' }}
        fieldErrors={{ confirm: messages.formErrors.confirmPassword.mismatch }}
      />,
    );

    expect(screen.getByText(messages.formErrors.confirmPassword.mismatch)).toBeTruthy();
  });

  it('khung 5d — link hỏng thì thay cả thân màn và mời xin link mới', async () => {
    const onRequestNewLink = jest.fn();
    const view = await renderWithTheme(
      <ResetPasswordScreen {...base} invalidLink onRequestNewLink={onRequestNewLink} />,
      'dark',
    );

    expect(view.getByText(messages.authForms.resetPassword.invalidToken.heading)).toBeTruthy();
    expect(view.queryByPlaceholderText(copy.newPassword)).toBeNull();

    await userEvent
      .setup()
      .press(view.getByText(messages.authForms.resetPassword.invalidToken.backLink));

    expect(onRequestNewLink).toHaveBeenCalled();
  });

  it('đang lưu thì đổi nhãn nút và khoá nút lại', async () => {
    await renderWithTheme(<ResetPasswordScreen {...base} pending />);

    expect(
      screen.getByRole('button', { name: messages.authForms.resetPassword.submitting }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});
