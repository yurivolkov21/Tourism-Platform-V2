import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { AuthGateSheet } from './auth-gate-sheet';

function baseProps() {
  return {
    visible: true,
    onClose: jest.fn(),
    title: 'Save tours you love',
    body: 'Sign in to save tours you love.',
    signInLabel: 'Sign in',
    createAccountLabel: 'Create account',
    onSignIn: jest.fn(),
    onCreateAccount: jest.fn(),
  };
}

describe('AuthGateSheet', () => {
  it('vẽ tiêu đề + câu giải thích khi visible', async () => {
    await renderWithTheme(<AuthGateSheet {...baseProps()} />);

    expect(screen.getByText('Save tours you love')).toBeTruthy();
    expect(screen.getByText('Sign in to save tours you love.')).toBeTruthy();
  });

  it('ẩn khi visible=false', async () => {
    await renderWithTheme(<AuthGateSheet {...baseProps()} visible={false} />);
    expect(screen.queryByText('Save tours you love')).toBeNull();
  });

  it('bấm "Sign in" gọi onSignIn, bấm "Create account" gọi onCreateAccount', async () => {
    const onSignIn = jest.fn();
    const onCreateAccount = jest.fn();
    await renderWithTheme(
      <AuthGateSheet {...baseProps()} onSignIn={onSignIn} onCreateAccount={onCreateAccount} />,
    );

    await fireEvent.press(screen.getByText('Sign in'));
    expect(onSignIn).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Create account'));
    expect(onCreateAccount).toHaveBeenCalled();
  });
});
