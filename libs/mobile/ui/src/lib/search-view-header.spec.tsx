import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { SearchViewHeader } from './search-view-header';

function renderHeader(value: string, onChangeText = jest.fn(), onBack = jest.fn()) {
  return renderWithTheme(
    <SearchViewHeader
      value={value}
      onChangeText={onChangeText}
      placeholder="Search tours"
      clearLabel="Clear search"
      backLabel="Back"
      onBack={onBack}
    />,
  );
}

describe('SearchViewHeader (B4 search view)', () => {
  it('đầu màn cao 72, nền containerHigh, có đường kẻ dưới', async () => {
    const theme = themeFor('light');
    await renderHeader('');

    const style = StyleSheet.flatten(screen.getByTestId('search-view-header').props.style);
    expect(style.height).toBe(72);
    expect(style.backgroundColor).toBe(theme.surfaces.containerHigh);
    expect(style.borderBottomWidth).toBeGreaterThan(0);
  });

  it('mũi tên lùi gọi onBack', async () => {
    const onBack = jest.fn();
    await renderHeader('ha', jest.fn(), onBack);

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('gõ gọi onChangeText; nút xoá chỉ hiện khi có chữ và xoá về rỗng', async () => {
    const onChangeText = jest.fn();
    await renderHeader('ha', onChangeText);

    await fireEvent.changeText(screen.getByPlaceholderText('Search tours'), 'hoi');
    expect(onChangeText).toHaveBeenCalledWith('hoi');
    await fireEvent.press(screen.getByLabelText('Clear search'));
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('ô rỗng thì không có nút xoá', async () => {
    await renderHeader('');

    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });
});
