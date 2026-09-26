import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { SignOutSheet, type SignOutSheetProps } from './sign-out-sheet';

function baseProps(overrides: Partial<SignOutSheetProps> = {}): SignOutSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    title: 'Sign out?',
    body: 'Your saved tours and bookings stay on your account.',
    confirmLabel: 'Sign out',
    cancelLabel: 'Stay signed in',
    onConfirm: jest.fn(),
    ...overrides,
  };
}

describe('SignOutSheet', () => {
  it('A5 — vẽ câu hỏi + hai nút', async () => {
    await renderWithTheme(<SignOutSheet {...baseProps()} />);

    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(screen.getByText('Your saved tours and bookings stay on your account.')).toBeTruthy();
  });

  it('bấm "Sign out" gọi onConfirm', async () => {
    const onConfirm = jest.fn();
    await renderWithTheme(<SignOutSheet {...baseProps({ onConfirm })} />);

    await fireEvent.press(screen.getByText('Sign out'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('bấm "Stay signed in" gọi onClose, không gọi onConfirm', async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    await renderWithTheme(<SignOutSheet {...baseProps({ onClose, onConfirm })} />);

    await fireEvent.press(screen.getByText('Stay signed in'));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
