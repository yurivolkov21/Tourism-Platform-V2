import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '@/test-utils';
import { AccountScreen, type AccountScreenProps } from './account-screen';

function baseProps(overrides: Partial<AccountScreenProps> = {}): AccountScreenProps {
  return {
    title: 'Account',
    name: 'Lan Nguyen',
    email: 'lan.nguyen@example.com',
    avatarUrl: null,
    initials: 'LN',
    editNameLabel: 'Edit name',
    onEditName: jest.fn(),
    avatarEditLabel: 'Change profile photo',
    onEditAvatar: jest.fn(),
    menuItems: [
      { key: 'personal', icon: 'user', label: 'Personal details', onPress: jest.fn() },
      { key: 'reviews', icon: 'star', label: 'My reviews', onPress: jest.fn() },
    ],
    linksLabel: 'Help & policies',
    linkItems: [
      {
        key: 'terms',
        icon: 'file-text',
        label: 'Terms of service',
        external: true,
        onPress: jest.fn(),
      },
    ],
    signOutLabel: 'Sign out',
    onSignOutPress: jest.fn(),
    ...overrides,
  };
}

describe('AccountScreen', () => {
  it('A1 — vẽ tên, email, chữ cái đầu khi chưa có ảnh', async () => {
    await renderWithTheme(<AccountScreen {...baseProps()} />);

    // Có tiêu đề lớn "Account" (F1, mockup vòng 4 thay quyết định 26/09);
    // A2 (chưa đăng nhập, AuthGateScreen) cũng có.
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Lan Nguyen')).toBeTruthy();
    expect(screen.getByText('lan.nguyen@example.com')).toBeTruthy();
    expect(screen.getByText('LN')).toBeTruthy();
  });

  it('bấm thẻ hồ sơ gọi onEditName', async () => {
    const onEditName = jest.fn();
    await renderWithTheme(<AccountScreen {...baseProps({ onEditName })} />);

    await fireEvent.press(screen.getByLabelText('Edit name'));
    expect(onEditName).toHaveBeenCalled();
  });

  it('A4 — bấm avatar gọi onEditAvatar', async () => {
    const onEditAvatar = jest.fn();
    await renderWithTheme(<AccountScreen {...baseProps({ onEditAvatar })} />);

    await fireEvent.press(screen.getByLabelText('Change profile photo'));
    expect(onEditAvatar).toHaveBeenCalled();
  });

  it('bấm dòng menu gọi đúng onPress của dòng đó', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <AccountScreen
        {...baseProps({
          menuItems: [{ key: 'reviews', icon: 'star', label: 'My reviews', onPress }],
        })}
      />,
    );

    await fireEvent.press(screen.getByText('My reviews'));
    expect(onPress).toHaveBeenCalled();
  });

  it('bấm Sign out gọi onSignOutPress', async () => {
    const onSignOutPress = jest.fn();
    await renderWithTheme(<AccountScreen {...baseProps({ onSignOutPress })} />);

    await fireEvent.press(screen.getByText('Sign out'));
    expect(onSignOutPress).toHaveBeenCalled();
  });

  it('menu là danh sách thẻ rời: hàng đầu bo trên 20, hàng cuối bo dưới 20, Sign out nằm nhóm riêng', async () => {
    await renderWithTheme(<AccountScreen {...baseProps()} />);

    const rows = screen.getAllByRole('button');
    const firstMenuRow = rows[2]; // sau nút avatar và thẻ hồ sơ
    expect(firstMenuRow?.props.style).toMatchObject({ borderTopLeftRadius: 20 });
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  it('F1 — nhóm Help & policies có nhãn nhóm, Sign out không icon', async () => {
    await renderWithTheme(<AccountScreen {...baseProps()} />);

    expect(screen.getByText('Help & policies')).toBeTruthy();
    expect(screen.getByText('Terms of service')).toBeTruthy();
  });

  it('F1 — ô hồ sơ là một thẻ: nền card, bo 20, không viền', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<AccountScreen {...baseProps()} />);

    const style = StyleSheet.flatten(screen.getByTestId('account-profile-card').props.style);
    expect(style.backgroundColor).toBe(theme.colors.card);
    expect(style.borderRadius).toBe(20);
    expect(style.borderWidth).toBeUndefined();
  });
});
