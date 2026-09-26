import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithTheme } from '@/test-utils';
import { AccountScreen, type AccountScreenProps } from './account-screen';

function baseProps(overrides: Partial<AccountScreenProps> = {}): AccountScreenProps {
  return {
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
  it('A1 — vẽ tên, email, chữ cái đầu khi chưa có ảnh', async () => {
    await renderWithTheme(<AccountScreen {...baseProps()} />);

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

  it('footer render được BÊN TRONG ScrollView (không mất tích như sibling ngoài Screen)', async () => {
    await renderWithTheme(<AccountScreen {...baseProps({ footer: <Text>Gallery (dev)</Text> })} />);

    expect(screen.getByText('Gallery (dev)')).toBeTruthy();
  });
});
