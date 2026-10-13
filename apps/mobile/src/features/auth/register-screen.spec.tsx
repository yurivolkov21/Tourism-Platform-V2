import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { RegisterScreen, type RegisterScreenProps } from './register-screen';

const copy = messages.mobile.auth.register;

const base: RegisterScreenProps = {
  values: { name: '', email: '', password: '' },
  fieldErrors: {},
  formMessage: null,
  pending: false,
  agreedToTerms: false,
  onChange: jest.fn(),
  onAgreeChange: jest.fn(),
  onSubmit: jest.fn(),
  showGoogle: true,
  onGoogle: jest.fn(),
  onSignIn: jest.fn(),
  onBack: jest.fn(),
};

describe('RegisterScreen', () => {
  // ADR-0056 §2: Expo Go không có module Google gốc, thiếu env Google cũng vậy —
  // route truyền `showGoogle={false}` và màn không vẽ nút Google lẫn dải "or".
  it('showGoogle=false: không có nút Google, không có dải "or"', async () => {
    await renderWithTheme(<RegisterScreen {...base} showGoogle={false} />);

    expect(screen.queryByText(messages.mobile.auth.signIn.google)).toBeNull();
    expect(screen.queryByText(messages.mobile.auth.signIn.or)).toBeNull();
  });

  it('showGoogle=true: có nút Google và dải "or"', async () => {
    await renderWithTheme(<RegisterScreen {...base} />);

    expect(screen.getByText(messages.mobile.auth.signIn.google)).toBeTruthy();
    expect(screen.getByText(messages.mobile.auth.signIn.or)).toBeTruthy();
  });

  it('khung 3a — trống: ba ô và nút chính bị khoá tới khi tick Terms', async () => {
    await renderWithTheme(<RegisterScreen {...base} />, 'dark');

    expect(screen.getByPlaceholderText(copy.name)).toBeTruthy();
    expect(screen.getByPlaceholderText(messages.mobile.auth.signIn.email)).toBeTruthy();
    expect(screen.getByPlaceholderText(messages.mobile.auth.signIn.password)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: copy.submit }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('tick Terms rồi thì nút mở ra', async () => {
    await renderWithTheme(<RegisterScreen {...base} agreedToTerms />);

    expect(
      screen.getByRole('button', { name: copy.submit }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  it('bấm ô tick thì báo ra ngoài', async () => {
    const onAgreeChange = jest.fn();
    await renderWithTheme(<RegisterScreen {...base} onAgreeChange={onAgreeChange} />);

    await fireEvent.press(
      screen.getByLabelText(
        `${messages.mobile.legal.agreePrefix}${messages.mobile.legal.agreeTerms}`,
      ),
    );

    expect(onAgreeChange).toHaveBeenCalledWith(true);
  });

  it('khung 3b — lỗi từng ô hiện dưới đúng ô sai', async () => {
    await renderWithTheme(
      <RegisterScreen
        {...base}
        agreedToTerms
        values={{ name: 'Lan Nguyen', email: 'lan.nguyen@', password: 'abc' }}
        fieldErrors={{
          email: messages.formErrors.email.invalid,
          password: messages.formErrors.password.tooShort,
        }}
      />,
      'dark',
    );

    expect(screen.getByText(messages.formErrors.email.invalid)).toBeTruthy();
    expect(screen.getByText(messages.formErrors.password.tooShort)).toBeTruthy();
  });

  it('đang gửi thì đổi nhãn nút', async () => {
    await renderWithTheme(<RegisterScreen {...base} agreedToTerms pending />);

    expect(screen.getByText(messages.authForms.register.submitting)).toBeTruthy();
  });
});
