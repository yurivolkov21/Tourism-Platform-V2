import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { BUTTON_VARIANTS, Button, type ButtonVariant } from './button';

const variants = Object.keys(BUTTON_VARIANTS) as ButtonVariant[];

describe('Button', () => {
  it.each(variants)('biến thể "%s" lấy màu nền/chữ ĐÚNG từ token', async (variant) => {
    const theme = themeFor('light');
    const { background, foreground } = BUTTON_VARIANTS[variant];
    await renderWithTheme(<Button label="Đặt tour" variant={variant} />);

    const button = screen.getByRole('button');
    const style = StyleSheet.flatten(button.props.style);
    const textStyle = StyleSheet.flatten(screen.getByText('Đặt tour').props.style);

    expect(style.backgroundColor).toBe(
      background === null ? 'transparent' : theme.colors[background],
    );
    expect(textStyle.color).toBe(theme.colors[foreground]);
  });

  it('có accessibilityRole "button" để trình đọc màn hình gọi đúng tên', async () => {
    await renderWithTheme(<Button label="Đặt tour" />);

    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('vùng chạm cao ít nhất bằng ngưỡng a11y trong token', async () => {
    await renderWithTheme(<Button label="Đặt tour" />);

    const style = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(style.minHeight).toBe(themeFor('light').touchTargetMin);
    expect(style.borderRadius).toBe(themeFor('light').radius.base);
  });

  it('gọi onPress khi bấm', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Đặt tour" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled thì CHẶN onPress, không chỉ làm mờ đi', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Đặt tour" disabled onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('disabled đổi sang màu muted và báo trạng thái cho trình đọc màn hình', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Button label="Đặt tour" disabled />);

    const button = screen.getByRole('button');
    const style = StyleSheet.flatten(button.props.style);
    const textStyle = StyleSheet.flatten(screen.getByText('Đặt tour').props.style);

    expect(style.backgroundColor).toBe(theme.colors.muted);
    expect(textStyle.color).toBe(theme.colors['muted-foreground']);
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
