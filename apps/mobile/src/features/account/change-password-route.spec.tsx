import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import ChangePasswordRoute from '@/app/change-password';
import { renderWithTheme } from '@/test-utils';

// Route A6 gọi thẳng `getAuthClient().changePassword` — giả lập để quyết kết quả của lần lưu.
const mockChangePassword = jest.fn();
jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({ changePassword: () => mockChangePassword() }),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const copy = messages.mobile.account.password;
const formError = messages.authForms.errors.generic;

/** Điền đủ ba ô hợp lệ rồi bấm "Save password". */
async function submitValidForm() {
  await fireEvent.changeText(screen.getByLabelText(copy.currentLabel), 'Old-Passw0rd!');
  await fireEvent.changeText(screen.getByLabelText(copy.newLabel), 'Str0ng-Passw0rd!');
  await fireEvent.changeText(screen.getByLabelText(copy.confirmLabel), 'Str0ng-Passw0rd!');
  await fireEvent.press(screen.getByRole('button', { name: copy.submit }));
}

describe('ChangePasswordRoute', () => {
  beforeEach(() => mockChangePassword.mockReset());

  // N8 (rà 07/10): khung lỗi cấp form nằm lì tới lần bấm Save sau dù khách đã gõ lại — màn Sign
  // in thì xoá ngay khi gõ.
  it('gõ lại sau một lỗi cấp form thì khung lỗi biến mất', async () => {
    mockChangePassword.mockRejectedValue(new Error('network down'));
    await renderWithTheme(<ChangePasswordRoute />);

    await submitValidForm();
    expect(await screen.findByText(formError)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText(copy.currentLabel), 'Old-Passw0rd!2');
    expect(screen.queryByText(formError)).toBeNull();
  });
});
