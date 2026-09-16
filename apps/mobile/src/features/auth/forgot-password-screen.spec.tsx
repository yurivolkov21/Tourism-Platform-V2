import { screen, userEvent } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { ForgotPasswordScreen, type ForgotPasswordScreenProps } from './forgot-password-screen';

const copy = messages.mobile.auth.forgotPassword;

const base: ForgotPasswordScreenProps = {
  email: '',
  fieldErrors: {},
  formMessage: null,
  pending: false,
  sent: false,
  onChangeEmail: jest.fn(),
  onSubmit: jest.fn(),
  onBackToSignIn: jest.fn(),
  onBack: jest.fn(),
};

describe('ForgotPasswordScreen', () => {
  it('khung 5a — một ô email và nút ghim đáy', async () => {
    await renderWithTheme(<ForgotPasswordScreen {...base} />, 'dark');

    expect(screen.getByText(copy.title)).toBeTruthy();
    expect(screen.getByPlaceholderText(messages.mobile.auth.signIn.email)).toBeTruthy();
    expect(screen.getByText(messages.authForms.forgotPassword.submit)).toBeTruthy();
  });

  it('email sai định dạng hiện ngay dưới ô', async () => {
    await renderWithTheme(
      <ForgotPasswordScreen
        {...base}
        email="lan@"
        fieldErrors={{ email: messages.formErrors.email.invalid }}
      />,
    );

    expect(screen.getByText(messages.formErrors.email.invalid)).toBeTruthy();
  });

  it('khung 5b — đã gửi thì đổi sang lời nhắn hộp thư, không còn ô nhập', async () => {
    await renderWithTheme(<ForgotPasswordScreen {...base} sent email="lan@example.com" />, 'dark');

    expect(screen.getByText(messages.authForms.forgotPassword.sentBody)).toBeTruthy();
    expect(screen.getByText(`${copy.sentTo} lan@example.com`)).toBeTruthy();
    expect(screen.queryByPlaceholderText(messages.mobile.auth.signIn.email)).toBeNull();
  });

  it('khung 5b — nút đưa về màn đăng nhập', async () => {
    const onBackToSignIn = jest.fn();
    const view = await renderWithTheme(
      <ForgotPasswordScreen
        {...base}
        sent
        email="lan@example.com"
        onBackToSignIn={onBackToSignIn}
      />,
    );

    await userEvent.setup().press(view.getByText(copy.backToSignIn));

    expect(onBackToSignIn).toHaveBeenCalled();
  });

  it('đang gửi thì đổi nhãn nút và khoá nút lại', async () => {
    await renderWithTheme(<ForgotPasswordScreen {...base} email="lan@example.com" pending />);

    expect(
      screen.getByRole('button', { name: messages.authForms.forgotPassword.submitting }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});
