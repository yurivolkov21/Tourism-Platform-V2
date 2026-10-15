import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import PasswordUpdatedRoute from '@/app/password-updated';
import { renderWithTheme } from '@/test-utils';

jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn() } }));

const copy = messages.mobile.account.password.done;

describe('PasswordUpdatedRoute', () => {
  beforeEach(() => jest.mocked(router.dismissTo).mockClear());

  it('báo đổi xong và nói rõ máy này vẫn đăng nhập, máy khác đã bị đăng xuất', async () => {
    await renderWithTheme(<PasswordUpdatedRoute />);

    expect(screen.getByText(copy.title)).toBeTruthy();
    expect(screen.getByText(copy.body)).toBeTruthy();
  });

  it('nút đi tiếp lùi về tab Account đang có, không dựng thêm bộ tab', async () => {
    await renderWithTheme(<PasswordUpdatedRoute />);

    await fireEvent.press(screen.getByRole('button', { name: copy.action }));

    expect(router.dismissTo).toHaveBeenCalledWith('/account');
  });
});
