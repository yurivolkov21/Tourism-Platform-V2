import { screen, userEvent } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { VerifyEmailScreen, type VerifyEmailScreenProps } from './verify-email-screen';

const copy = messages.mobile.auth.verifyEmail;

const base: VerifyEmailScreenProps = {
  email: 'lan.nguyen@example.com',
  reason: 'signup',
  otp: '',
  fieldErrors: {},
  formMessage: null,
  pending: false,
  remaining: 60,
  onChangeOtp: jest.fn(),
  onSubmit: jest.fn(),
  onResend: jest.fn(),
  onBack: jest.fn(),
};

describe('VerifyEmailScreen', () => {
  it('khung 4a — sau đăng ký: phụ đề thường, đếm ngược và câu nhắc trùng email', async () => {
    await renderWithTheme(<VerifyEmailScreen {...base} remaining={42} />, 'dark');

    expect(screen.getByText(new RegExp(copy.body))).toBeTruthy();
    expect(screen.getByText('0:42')).toBeTruthy();
    expect(screen.getByText(messages.authForms.verifyEmail.existingAccountHint)).toBeTruthy();
    expect(screen.getAllByTestId('otp-cell')).toHaveLength(6);
  });

  it('khung 4b — vào từ Sign in: lý do nằm trong phụ đề, không có dải riêng', async () => {
    await renderWithTheme(<VerifyEmailScreen {...base} reason="blocked" />);

    expect(screen.getByText(new RegExp(copy.blockedBody))).toBeTruthy();
    // Câu nhắc trùng email chỉ dành cho người vừa đăng ký.
    expect(screen.queryByText(messages.authForms.verifyEmail.existingAccountHint)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('khung 4c — vừa gửi lại mã: khung thông tin nằm trên nút ghim', async () => {
    await renderWithTheme(
      <VerifyEmailScreen {...base} formMessage={{ tone: 'info', text: copy.resent }} />,
    );

    expect(screen.getByText(copy.resent)).toBeTruthy();
  });

  it('mã sai hiện ngay dưới ô mã', async () => {
    await renderWithTheme(
      <VerifyEmailScreen
        {...base}
        otp="482190"
        fieldErrors={{ otp: messages.authForms.errors.invalidOtp }}
      />,
      'dark',
    );

    expect(screen.getByText(messages.authForms.errors.invalidOtp)).toBeTruthy();
  });

  it('chưa gõ đủ 6 số thì nút Verify còn khoá', async () => {
    await renderWithTheme(<VerifyEmailScreen {...base} otp="482" />);

    expect(
      screen.getByRole('button', { name: copy.submit }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('còn đếm ngược thì chưa cho gửi lại; hết giờ mới hiện đường gửi lại', async () => {
    const view = await renderWithTheme(<VerifyEmailScreen {...base} remaining={12} />);

    expect(view.queryByText(copy.resendAction)).toBeNull();

    await view.rerender(<VerifyEmailScreen {...base} remaining={0} />);

    expect(view.getByText(copy.resendAction)).toBeTruthy();
    expect(view.queryByText(copy.resendIn)).toBeNull();
  });

  it('bấm gửi lại và bấm quay lại đều báo ra ngoài', async () => {
    const onResend = jest.fn();
    const onBack = jest.fn();
    const view = await renderWithTheme(
      <VerifyEmailScreen {...base} remaining={0} onResend={onResend} onBack={onBack} />,
    );

    const user = userEvent.setup();
    await user.press(view.getByText(copy.resendAction));
    await user.press(view.getByLabelText(messages.mobile.auth.back));

    expect(onResend).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
