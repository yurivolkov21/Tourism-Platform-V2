import { screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { Screen } from './screen';

describe('Screen', () => {
  it('phủ nền bằng màu `background` của token, không phải màu viết tay', async () => {
    await renderWithTheme(
      <Screen testID="screen">
        <Text>nội dung</Text>
      </Screen>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('screen').props.style);
    expect(style.backgroundColor).toBe(themeFor('light').colors.background);
    expect(style.flex).toBe(1);
  });

  it('đổi sang chế độ tối thì nền đổi theo token tối', async () => {
    await renderWithTheme(<Screen testID="screen" />, 'dark');

    const style = StyleSheet.flatten(screen.getByTestId('screen').props.style);
    expect(style.backgroundColor).toBe(themeFor('dark').colors.background);
  });

  it('đệm mặc định là bội số của bước spacing trong token', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Screen testID="screen" />);

    const style = StyleSheet.flatten(screen.getByTestId('screen').props.style);
    expect(style.paddingHorizontal).toBe(theme.spacing(5));
    expect(style.paddingVertical).toBe(theme.spacing(4));
  });

  it('`padded={false}` bỏ đệm cho màn có nội dung tràn mép', async () => {
    await renderWithTheme(<Screen testID="screen" padded={false} />);

    const style = StyleSheet.flatten(screen.getByTestId('screen').props.style);
    expect(style.paddingHorizontal).toBeUndefined();
  });

  it('render được con của nó', async () => {
    await renderWithTheme(
      <Screen>
        <Text>xin chào</Text>
      </Screen>,
    );

    expect(screen.getByText('xin chào')).toBeTruthy();
  });
});
