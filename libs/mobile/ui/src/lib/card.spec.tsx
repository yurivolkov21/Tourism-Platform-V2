import { screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { Card } from './card';

describe('Card', () => {
  it('lấy nền, viền và bo góc từ token', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Card testID="card" />);

    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.backgroundColor).toBe(theme.colors.card);
    expect(style.borderColor).toBe(theme.colors.border);
    expect(style.borderRadius).toBe(theme.radius.base);
    expect(style.borderWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('đổi sang chế độ tối thì nền và viền đổi theo', async () => {
    const dark = themeFor('dark');
    await renderWithTheme(<Card testID="card" />, 'dark');

    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.backgroundColor).toBe(dark.colors.card);
    expect(style.borderColor).toBe(dark.colors.border);
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
