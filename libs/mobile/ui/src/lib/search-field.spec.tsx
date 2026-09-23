import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { SearchField } from './search-field';

describe('SearchField', () => {
  it('gọi onChangeText khi gõ', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <SearchField value="" onChangeText={onChangeText} placeholder="Search tours" />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('Search tours'), 'ha');
    expect(onChangeText).toHaveBeenCalledWith('ha');
  });

  it('nền pill và viền mặc định lấy đúng token', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<SearchField value="" onChangeText={jest.fn()} placeholder="Search" />);
    const style = StyleSheet.flatten(screen.getByTestId('search-field-shell').props.style);
    expect(style.backgroundColor).toBe(theme.colors.card);
    expect(style.borderColor).toBe(theme.colors.border);
    expect(style.borderWidth).toBe(1);
  });

  it('focus đổi viền sang 2px primary-emphasis', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<SearchField value="" onChangeText={jest.fn()} placeholder="Search" />);
    const input = screen.getByPlaceholderText('Search');
    await fireEvent(input, 'focus');
    const style = StyleSheet.flatten(screen.getByTestId('search-field-shell').props.style);
    expect(style.borderWidth).toBe(2);
    expect(style.borderColor).toBe(theme.colors['primary-emphasis']);
  });

  it('có nút xoá khi value không rỗng, bấm thì gọi onChangeText("")', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <SearchField value="ha noi" onChangeText={onChangeText} placeholder="Search" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /clear/i }));
    expect(onChangeText).toHaveBeenCalledWith('');
  });
});
