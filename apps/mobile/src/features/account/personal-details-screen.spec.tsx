import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { PersonalDetailsScreen, type PersonalDetailsScreenProps } from './personal-details-screen';

function baseProps(
  overrides: Partial<PersonalDetailsScreenProps> = {},
): PersonalDetailsScreenProps {
  return {
    name: 'Lan Nguyen',
    email: 'lan.nguyen@example.com',
    nameLabel: 'Name',
    emailLabel: 'Email',
    deleteAccountLabel: 'Delete account',
    onDeleteAccountPress: jest.fn(),
    ...overrides,
  };
}

describe('PersonalDetailsScreen', () => {
  it('vẽ Name và Email của phiên, KHÔNG có ô sửa (chỉ hiển thị)', async () => {
    await renderWithTheme(<PersonalDetailsScreen {...baseProps()} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Lan Nguyen')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('lan.nguyen@example.com')).toBeTruthy();
  });

  it('bấm Delete account gọi onDeleteAccountPress', async () => {
    const onDeleteAccountPress = jest.fn();
    await renderWithTheme(<PersonalDetailsScreen {...baseProps({ onDeleteAccountPress })} />);
    await fireEvent.press(screen.getByText('Delete account'));
    expect(onDeleteAccountPress).toHaveBeenCalled();
  });
});
