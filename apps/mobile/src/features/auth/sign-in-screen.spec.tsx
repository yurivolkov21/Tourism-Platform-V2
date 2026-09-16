import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { SignInScreen, type SignInScreenProps } from './sign-in-screen';

const copy = messages.mobile.auth.signIn;

const base: SignInScreenProps = {
  values: { email: '', password: '' },
  fieldErrors: {},
  formMessage: null,
  pending: false,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  onGoogle: jest.fn(),
  onForgot: jest.fn(),
  onCreateAccount: jest.fn(),
  onClose: jest.fn(),
};

describe('SignInScreen', () => {
  it('khung 2a — trống: đủ hai ô, nút chính, Google và đường sang đăng ký', async () => {
    await renderWithTheme(<SignInScreen {...base} />, 'dark');

    expect(screen.getByPlaceholderText(copy.email)).toBeTruthy();
    expect(screen.getByPlaceholderText(copy.password)).toBeTruthy();
    expect(screen.getByText(copy.submit)).toBeTruthy();
    expect(screen.getByText(copy.google)).toBeTruthy();
    expect(screen.getByText(copy.footerAction)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('khung 2b — lỗi cấp form hiện trong khung, không gắn vào ô nào', async () => {
    await renderWithTheme(
      <SignInScreen
        {...base}
        values={{ email: 'lan@example.com', password: 'correct-horse' }}
        formMessage={{ tone: 'error', text: messages.authForms.errors.invalidCredentials }}
      />,
      'dark',
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(messages.authForms.errors.invalidCredentials)).toBeTruthy();
  });

  it('lỗi của ô hiện ngay dưới ô đó', async () => {
    await renderWithTheme(
      <SignInScreen {...base} fieldErrors={{ email: messages.formErrors.email.invalid }} />,
    );

    expect(screen.getByText(messages.formErrors.email.invalid)).toBeTruthy();
  });

  it('đang gửi thì đổi nhãn nút và khoá nút lại', async () => {
    await renderWithTheme(<SignInScreen {...base} pending />);

    expect(screen.getByText(messages.authForms.login.submitting)).toBeTruthy();
    expect(screen.queryByText(copy.submit)).toBeNull();
    expect(
      screen.getByRole('button', { name: messages.authForms.login.submitting }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('bấm các nút thì gọi đúng hàm được truyền vào', async () => {
    const onSubmit = jest.fn();
    const onGoogle = jest.fn();
    const onForgot = jest.fn();
    const onCreateAccount = jest.fn();
    const view = await renderWithTheme(
      <SignInScreen
        {...base}
        onSubmit={onSubmit}
        onGoogle={onGoogle}
        onForgot={onForgot}
        onCreateAccount={onCreateAccount}
      />,
    );

    // `userEvent` là API bất đồng bộ của RNTL 14: mỗi thao tác được bọc trong
    // act và đợi cây ổn định. Đo được trên chính file này: dùng `fireEvent` cho
    // một loạt bốn cú bấm để lại phần việc treo, và MỌI test sau trong file
    // render ra cây RỖNG — lỗi hiện ra ở test khác chứ không ở test gây ra nó.
    const user = userEvent.setup();
    await user.press(view.getByText(copy.submit));
    await user.press(view.getByText(copy.google));
    await user.press(view.getByText(copy.forgot));
    await user.press(view.getByText(copy.footerAction));

    expect(onSubmit).toHaveBeenCalled();
    expect(onGoogle).toHaveBeenCalled();
    expect(onForgot).toHaveBeenCalled();
    expect(onCreateAccount).toHaveBeenCalled();
  });

  it('gõ vào ô email thì báo đúng tên ô và giá trị', async () => {
    const onChange = jest.fn();
    // Dùng bộ query TRẢ VỀ từ chính lần render này thay vì `screen` toàn cục:
    // `screen` trỏ tới cây render gần nhất, mà RNTL 14 render bất đồng bộ nên
    // sau một test có nhiều thao tác nó có thể còn đang trỏ chỗ khác.
    const view = await renderWithTheme(<SignInScreen {...base} onChange={onChange} />);

    await fireEvent.changeText(view.getByPlaceholderText(copy.email), 'lan@example.com');

    expect(onChange).toHaveBeenCalledWith('email', 'lan@example.com');
  });
});
