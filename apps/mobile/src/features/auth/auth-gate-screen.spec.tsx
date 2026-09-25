import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { AuthGateScreen, type AuthGateScreenProps } from './auth-gate-screen';

function baseProps(overrides: Partial<AuthGateScreenProps> = {}): AuthGateScreenProps {
  return {
    icon: 'heart',
    title: 'Save tours you love',
    body: 'Sign in to keep a wishlist of tours and find them here anytime.',
    signInLabel: 'Sign in',
    createAccountLabel: 'Create account',
    onSignIn: jest.fn(),
    onCreateAccount: jest.fn(),
    ...overrides,
  };
}

describe('AuthGateScreen', () => {
  it('vẽ tiêu đề + câu giải thích', async () => {
    await renderWithTheme(<AuthGateScreen {...baseProps()} />);
    expect(screen.getByText('Save tours you love')).toBeTruthy();
    expect(
      screen.getByText('Sign in to keep a wishlist of tours and find them here anytime.'),
    ).toBeTruthy();
  });

  it('bấm Sign in/Create account gọi đúng callback', async () => {
    const onSignIn = jest.fn();
    const onCreateAccount = jest.fn();
    await renderWithTheme(<AuthGateScreen {...baseProps({ onSignIn, onCreateAccount })} />);
    await fireEvent.press(screen.getByText('Sign in'));
    expect(onSignIn).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Create account'));
    expect(onCreateAccount).toHaveBeenCalled();
  });

  it('không có legalLinks: không vẽ khối link pháp lý nào', async () => {
    await renderWithTheme(<AuthGateScreen {...baseProps()} />);
    expect(screen.queryByText('Privacy policy')).toBeNull();
  });

  it('có legalLinks: vẽ từng dòng, bấm gọi đúng onPress của dòng đó', async () => {
    const onPrivacy = jest.fn();
    await renderWithTheme(
      <AuthGateScreen
        {...baseProps({
          legalLinks: [
            { label: 'Privacy policy', icon: 'file-text', onPress: onPrivacy },
            { label: 'Terms of service', icon: 'file-text', onPress: jest.fn() },
          ],
        })}
      />,
    );
    expect(screen.getByText('Terms of service')).toBeTruthy();
    await fireEvent.press(screen.getByText('Privacy policy'));
    expect(onPrivacy).toHaveBeenCalled();
  });
});
