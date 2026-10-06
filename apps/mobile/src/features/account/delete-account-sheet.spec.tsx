import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { DeleteAccountSheet, type DeleteAccountSheetProps } from './delete-account-sheet';

function baseProps(overrides: Partial<DeleteAccountSheetProps> = {}): DeleteAccountSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    title: 'Delete your account?',
    body: 'Your profile, saved tours and reviews are removed for good.',
    passwordLabel: 'Current password',
    password: '',
    formError: null,
    pending: false,
    revealLabel: 'Show password',
    hideLabel: 'Hide password',
    confirmLabel: 'Delete account',
    deletingLabel: 'Deleting…',
    cancelLabel: 'Keep my account',
    onChangePassword: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
}

describe('DeleteAccountSheet', () => {
  it('A7 — vẽ heading, câu giải thích, ô mật khẩu, hai nút', async () => {
    await renderWithTheme(<DeleteAccountSheet {...baseProps()} />);
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(
      screen.getByText('Your profile, saved tours and reviews are removed for good.'),
    ).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();
    expect(screen.getByText('Keep my account')).toBeTruthy();
  });

  it('bấm Delete account gọi onConfirm', async () => {
    const onConfirm = jest.fn();
    await renderWithTheme(<DeleteAccountSheet {...baseProps({ onConfirm })} />);
    await fireEvent.press(screen.getByText('Delete account'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('bấm Keep my account gọi onClose', async () => {
    const onClose = jest.fn();
    await renderWithTheme(<DeleteAccountSheet {...baseProps({ onClose })} />);
    await fireEvent.press(screen.getByText('Keep my account'));
    expect(onClose).toHaveBeenCalled();
  });

  it('lỗi mật khẩu hiện dưới ô', async () => {
    await renderWithTheme(
      <DeleteAccountSheet {...baseProps({ passwordError: 'Enter your password.' })} />,
    );
    expect(screen.getByText('Enter your password.')).toBeTruthy();
  });

  it('lỗi cấp form hiện trong khung thông báo', async () => {
    await renderWithTheme(
      <DeleteAccountSheet {...baseProps({ formError: 'Your session has expired.' })} />,
    );
    expect(screen.getByText('Your session has expired.')).toBeTruthy();
  });

  it('đang xoá thì đổi nhãn và khoá nút xác nhận', async () => {
    const onConfirm = jest.fn();
    await renderWithTheme(<DeleteAccountSheet {...baseProps({ pending: true, onConfirm })} />);
    expect(screen.queryByText('Delete account')).toBeNull();
    await fireEvent.press(screen.getByText('Deleting…'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
