import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { ResultScreen } from './result-screen';

describe('ResultScreen', () => {
  it('in tiêu đề, nội dung và nút đi tiếp', async () => {
    const onAction = jest.fn();
    await renderWithTheme(
      <ResultScreen
        icon="check"
        title="Email verified"
        body="Welcome aboard — log in to start travelling."
        actionLabel="Sign in"
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Email verified')).toBeTruthy();
    expect(screen.getByText('Welcome aboard — log in to start travelling.')).toBeTruthy();

    fireEvent.press(screen.getByText('Sign in'));

    expect(onAction).toHaveBeenCalled();
  });

  it('dùng lại được cho kết quả đổi mật khẩu — chỉ khác icon và chữ', async () => {
    await renderWithTheme(
      <ResultScreen
        icon="key"
        title="Password updated"
        body="Log in with your new password to continue."
        actionLabel="Sign in"
        onAction={() => {}}
      />,
    );

    expect(screen.getByText('Password updated')).toBeTruthy();
  });
});
