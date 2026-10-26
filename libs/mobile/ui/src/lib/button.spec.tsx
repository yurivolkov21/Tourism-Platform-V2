import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { BUTTON_VARIANTS, Button, type ButtonSpec, type ButtonVariant } from './button';
import { withAlpha } from './theme';

const variants = Object.keys(BUTTON_VARIANTS) as ButtonVariant[];

describe('Button', () => {
  it.each(variants)('biến thể "%s" lấy màu nền/chữ ĐÚNG từ token', async (variant) => {
    const theme = themeFor('light');
    const { background, foreground, backgroundAlpha = 1 }: ButtonSpec = BUTTON_VARIANTS[variant];
    await renderWithTheme(<Button label="Đặt tour" variant={variant} />);

    const button = screen.getByRole('button');
    const style = StyleSheet.flatten(button.props.style);
    const textStyle = StyleSheet.flatten(screen.getByText('Đặt tour').props.style);

    expect(style.backgroundColor).toBe(
      background === null
        ? 'transparent'
        : backgroundAlpha === 1
          ? theme.colors[background]
          : withAlpha(theme.colors[background], backgroundAlpha),
    );
    expect(textStyle.color).toBe(theme.colors[foreground]);
  });

  it('biến thể "destructive" nền đỏ `destructive` (không phải màu mực), chữ primary-foreground — cả hai theme', async () => {
    for (const scheme of ['light', 'dark'] as const) {
      const theme = themeFor(scheme);
      const { unmount } = await renderWithTheme(
        <Button label="Sign out" variant="destructive" />,
        scheme,
      );
      const style = StyleSheet.flatten(screen.getByRole('button').props.style);
      const textStyle = StyleSheet.flatten(screen.getByText('Sign out').props.style);
      expect(style.backgroundColor).toBe(theme.colors.destructive);
      expect(textStyle.color).toBe(theme.colors['primary-foreground']);
      await unmount();
    }
  });

  it('biến thể "ghost" là nút tông: nền secondary, chữ secondary-foreground, không viền', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(<Button label="Stay signed in" variant="ghost" />, 'dark');
    const style = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(style.backgroundColor).toBe(theme.colors.secondary);
    expect(style.borderWidth ?? 0).toBe(0);
  });

  it('biến thể "media" nền chữ-trên-ảnh alpha 0,22, không viền', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(<Button label="Đặt tour" variant="media" />, 'dark');

    const style = StyleSheet.flatten(screen.getByRole('button').props.style);

    expect(style.backgroundColor).toBe(withAlpha(theme.colors['on-media'], 0.22));
    expect(style.borderWidth).toBeUndefined();
  });

  it('có accessibilityRole "button" để trình đọc màn hình gọi đúng tên', async () => {
    await renderWithTheme(<Button label="Đặt tour" />);

    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('nút chính cao 56 và bo 28 (Material 3), không bóng', async () => {
    await renderWithTheme(<Button label="Đặt tour" />);

    const style = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(style.minHeight).toBe(56);
    expect(style.borderRadius).toBe(28);
    expect(style.shadowOpacity).toBeUndefined();
    expect(style.elevation).toBeUndefined();
  });

  it('nút nhỏ cao 40, bo 20, chữ 14 medium, vẫn có vùng chạm 44 nhờ hitSlop', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Button label="Đặt tour" size="small" />);

    const button = screen.getByRole('button');
    const style = StyleSheet.flatten(button.props.style);
    const text = StyleSheet.flatten(screen.getByText('Đặt tour').props.style);
    expect(style.minHeight).toBe(40);
    expect(style.borderRadius).toBe(20);
    expect(text.fontSize).toBe(14);
    expect(text.fontWeight).toBe(theme.weight.medium);
    expect(button.props.hitSlop).toEqual({ top: 2, bottom: 2 });
  });

  it('chữ nút là 16 medium', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Button label="Đặt tour" />);

    const text = StyleSheet.flatten(screen.getByText('Đặt tour').props.style);
    expect(text.fontSize).toBe(16);
    expect(text.fontWeight).toBe(theme.weight.medium);
  });

  it('nút phụ nền secondary, không viền', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Button label="Đặt tour" variant="secondary" />);

    const style = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(style.backgroundColor).toBe(theme.colors.secondary);
    expect(style.borderWidth).toBeUndefined();
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

  // `{...rest}` của Button trải SAU `accessibilityState`, nên về hình thức một
  // caller viết `accessibilityState={{ busy: true }}` có vẻ xoá mất `disabled`.
  // Thực tế KHÔNG: `Pressable` của React Native ép lại `disabled` vào
  // accessibilityState mỗi khi prop `disabled` khác null (Pressable.js —
  // `disabled != null ? {..._accessibilityState, disabled} : …`), mà Button
  // luôn truyền boolean thật. Test này ghim đúng lời bảo đảm đi mượn đó: ngày
  // React Native đổi hành vi, đây là chỗ báo — chứ không phải người dùng dùng
  // trình đọc màn hình.
  it('cờ a11y của caller cộng vào mà `disabled` vẫn đúng', async () => {
    await renderWithTheme(
      <Button label="Book now" disabled accessibilityState={{ busy: true }} onPress={() => {}} />,
    );

    const state = screen.getByRole('button').props.accessibilityState;
    expect(state.busy).toBe(true);
    expect(state.disabled).toBe(true);
  });
});

describe('Button — icon và hình dáng (P5b-1)', () => {
  it('vẽ icon đứng trước nhãn khi được truyền', async () => {
    await renderWithTheme(
      <Button label="Continue with Google" leading={<Text>G</Text>} onPress={() => {}} />,
    );

    expect(screen.getByText('G')).toBeTruthy();
    expect(screen.getByText('Continue with Google')).toBeTruthy();
  });
});
