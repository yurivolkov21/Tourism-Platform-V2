import { screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { ChangePasswordScreen, type ChangePasswordScreenProps } from './change-password-screen';

const copy = messages.mobile.account.password;

const base: ChangePasswordScreenProps = {
  values: { currentPassword: '', newPassword: '', confirmPassword: '' },
  fieldErrors: {},
  formMessage: null,
  pending: false,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
};

describe('ChangePasswordScreen', () => {
  it('A6 — ba ô, câu cảnh báo thu hồi phiên, nút Save password', async () => {
    await renderWithTheme(<ChangePasswordScreen {...base} />, 'dark');

    expect(screen.getByText(copy.revokeNotice)).toBeTruthy();
    expect(screen.getByPlaceholderText(copy.currentLabel)).toBeTruthy();
    expect(screen.getByPlaceholderText(copy.newLabel)).toBeTruthy();
    expect(screen.getByPlaceholderText(copy.confirmLabel)).toBeTruthy();
    expect(screen.getByText(copy.submit)).toBeTruthy();
  });

  it('lỗi mật khẩu hiện tại sai nằm dưới đúng ô đầu', async () => {
    await renderWithTheme(
      <ChangePasswordScreen
        {...base}
        fieldErrors={{ currentPassword: messages.authForms.errors.wrongCurrentPassword }}
      />,
    );

    expect(screen.getByText(messages.authForms.errors.wrongCurrentPassword)).toBeTruthy();
  });

  it('lỗi cấp form hiện trong FormMessage', async () => {
    await renderWithTheme(
      <ChangePasswordScreen
        {...base}
        formMessage={{ tone: 'error', text: messages.authForms.errors.generic }}
      />,
    );

    expect(screen.getByText(messages.authForms.errors.generic)).toBeTruthy();
  });

  it('đang lưu thì đổi nhãn nút và khoá nút lại', async () => {
    await renderWithTheme(<ChangePasswordScreen {...base} pending />);

    expect(
      screen.getByRole('button', { name: copy.submitting }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});
