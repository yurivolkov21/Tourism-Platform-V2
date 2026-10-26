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
    passwordLabel: 'Password',
    onNamePress: jest.fn(),
    onPasswordPress: jest.fn(),
    deleteAccountLabel: 'Delete account',
    onDeleteAccountPress: jest.fn(),
    ...overrides,
  };
}

describe('PersonalDetailsScreen', () => {
  it('vẽ Name, Email và Password (giá trị che) của phiên', async () => {
    await renderWithTheme(<PersonalDetailsScreen {...baseProps()} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Lan Nguyen')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('lan.nguyen@example.com')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    expect(screen.getByText('••••••••')).toBeTruthy();
  });

  it('bấm Name và Password gọi đúng callback, Email không bấm được', async () => {
    const onNamePress = jest.fn();
    const onPasswordPress = jest.fn();
    await renderWithTheme(
      <PersonalDetailsScreen {...baseProps({ onNamePress, onPasswordPress })} />,
    );
    await fireEvent.press(screen.getByText('Name'));
    await fireEvent.press(screen.getByText('Password'));
    expect(onNamePress).toHaveBeenCalledTimes(1);
    expect(onPasswordPress).toHaveBeenCalledTimes(1);
  });

  it('bấm Delete account gọi onDeleteAccountPress', async () => {
    const onDeleteAccountPress = jest.fn();
    await renderWithTheme(<PersonalDetailsScreen {...baseProps({ onDeleteAccountPress })} />);
    await fireEvent.press(screen.getByText('Delete account'));
    expect(onDeleteAccountPress).toHaveBeenCalled();
  });
});
