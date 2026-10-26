import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { SearchField } from './search-field';

describe('SearchField', () => {
  it('gọi onChangeText khi gõ', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <SearchField
        value=""
        onChangeText={onChangeText}
        placeholder="Search tours"
        clearLabel="Clear search"
      />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('Search tours'), 'ha');
    expect(onChangeText).toHaveBeenCalledWith('ha');
  });

  it('thanh tìm Material 3: cao 56, bo 28, nền containerHigh, không viền', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <SearchField
        value=""
        onChangeText={jest.fn()}
        placeholder="Search"
        clearLabel="Clear search"
      />,
    );
    const style = StyleSheet.flatten(screen.getByTestId('search-field-shell').props.style);
    expect(style.height).toBe(56);
    expect(style.borderRadius).toBe(28);
    expect(style.backgroundColor).toBe(theme.surfaces.containerHigh);
    expect(style.borderWidth).toBeUndefined();
  });

  it('focus vẫn không vẽ viền — chỉ chữ đổi sang foreground', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <SearchField
        value=""
        onChangeText={jest.fn()}
        placeholder="Search"
        clearLabel="Clear search"
      />,
    );
    const input = screen.getByPlaceholderText('Search');
    await fireEvent(input, 'focus');
    const style = StyleSheet.flatten(screen.getByTestId('search-field-shell').props.style);
    expect(style.borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByPlaceholderText('Search').props.style).color).toBe(
      theme.colors.foreground,
    );
  });

  it('có nút xoá khi value không rỗng, bấm thì gọi onChangeText("")', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <SearchField
        value="ha noi"
        onChangeText={onChangeText}
        placeholder="Search"
        clearLabel="Clear search"
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChangeText).toHaveBeenCalledWith('');
  });
});
