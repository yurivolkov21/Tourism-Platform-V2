import { screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { Card } from './card';

describe('Card', () => {
  it('nền card, bo 16, không viền, không bóng (Material 3)', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Card testID="card" />);

    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.backgroundColor).toBe(theme.colors.card);
    expect(style.borderRadius).toBe(16);
    expect(style.borderWidth).toBeUndefined();
    expect(style.shadowOpacity).toBeUndefined();
    expect(style.elevation).toBeUndefined();
  });

  it('đổi sang chế độ tối thì nền đổi theo', async () => {
    const dark = themeFor('dark');
    await renderWithTheme(<Card testID="card" />, 'dark');

    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.backgroundColor).toBe(dark.colors.card);
  });

  it('render được con của nó', async () => {
    await renderWithTheme(
      <Card>
        <Text>nội dung thẻ</Text>
      </Card>,
    );

    expect(screen.getByText('nội dung thẻ')).toBeTruthy();
  });
});
