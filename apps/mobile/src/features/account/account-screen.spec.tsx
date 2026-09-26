import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithTheme } from '@/test-utils';
import { AccountScreen, type AccountScreenProps } from './account-screen';

function baseProps(overrides: Partial<AccountScreenProps> = {}): AccountScreenProps {
  return {
    pageTitle: 'Account',
    name: 'Lan Nguyen',
    email: 'lan.nguyen@example.com',
    avatarUrl: null,
    initials: 'LN',
    editNameLabel: 'Edit name',
    onEditName: jest.fn(),
    menuItems: [
      { key: 'personal', icon: 'user', label: 'Personal details', onPress: jest.fn() },
      { key: 'saved', icon: 'heart', label: 'Saved tours', onPress: jest.fn() },
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
  it('A1 — vẽ tiêu đề trang, tên, email, chữ cái đầu khi chưa có ảnh', async () => {
    await renderWithTheme(<AccountScreen {...baseProps()} />);

    // Tiêu đề trang "Account" ĐỨNG RIÊNG với tên người dùng (phản hồi 26/09 —
    // trước đó thiếu, làm A1/A2 lệch nhau).
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Lan Nguyen')).toBeTruthy();
    expect(screen.getByText('lan.nguyen@example.com')).toBeTruthy();
    expect(screen.getByText('LN')).toBeTruthy();
  });

  it('bấm bút chì gọi onEditName', async () => {
    const onEditName = jest.fn();
    await renderWithTheme(<AccountScreen {...baseProps({ onEditName })} />);

    await fireEvent.press(screen.getByLabelText('Edit name'));
    expect(onEditName).toHaveBeenCalled();
  });

  it('bấm dòng menu gọi đúng onPress của dòng đó', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <AccountScreen
        {...baseProps({
          menuItems: [{ key: 'saved', icon: 'heart', label: 'Saved tours', onPress }],
        })}
      />,
    );

    await fireEvent.press(screen.getByText('Saved tours'));
    expect(onPress).toHaveBeenCalled();
  });

  it('bấm Sign out gọi onSignOutPress', async () => {
    const onSignOutPress = jest.fn();
    await renderWithTheme(<AccountScreen {...baseProps({ onSignOutPress })} />);

    await fireEvent.press(screen.getByText('Sign out'));
    expect(onSignOutPress).toHaveBeenCalled();
  });

  it('dòng menu CUỐI không có viền dưới — Sign out ngay sau đã có viền trên riêng, tránh gạch đôi', async () => {
    await renderWithTheme(<AccountScreen {...baseProps()} />);

    const rows = screen.getAllByRole('button');
    // Ba dòng menu (personal/saved/terms) đứng TRƯỚC "Sign out"/"Edit name"
    // trong cây — đọc theo đúng thứ tự dựng ở JSX.
    const lastMenuRow = rows[rows.length - 2]; // dòng cuối menuItems, ngay trước Sign out
    expect(lastMenuRow?.props.style).toMatchObject({ borderBottomWidth: 0 });
  });

  it('footer render được BÊN TRONG ScrollView (không mất tích như sibling ngoài Screen)', async () => {
    await renderWithTheme(<AccountScreen {...baseProps({ footer: <Text>Gallery (dev)</Text> })} />);

    expect(screen.getByText('Gallery (dev)')).toBeTruthy();
  });
});
