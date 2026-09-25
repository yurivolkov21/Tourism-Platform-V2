import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { RegionRail } from './region-rail';

const ITEMS = [
  { key: 'north', label: 'North' },
  { key: 'central', label: 'Central' },
  { key: 'south', label: 'South' },
];

describe('RegionRail', () => {
  it('đoạn đang chọn có màu primary-emphasis, chữ đậm và vạch chỉ báo', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<RegionRail items={ITEMS} selected="north" onSelect={jest.fn()} />);

    const style = StyleSheet.flatten(screen.getByText('North').props.style);
    expect(style.color).toBe(theme.colors['primary-emphasis']);
    expect(style.fontFamily).toBe(theme.fonts.semibold);
    expect(screen.getByTestId('region-rail-indicator')).toBeTruthy();
  });

  it('đoạn không chọn màu muted-foreground, chữ thường', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<RegionRail items={ITEMS} selected="north" onSelect={jest.fn()} />);

    const style = StyleSheet.flatten(screen.getByText('Central').props.style);
    expect(style.color).toBe(theme.colors['muted-foreground']);
    expect(style.fontFamily).toBe(theme.fonts.normal);
  });

  it('không có đoạn nào đang chọn thì không vẽ vạch chỉ báo', async () => {
    await renderWithTheme(<RegionRail items={ITEMS} selected="unknown" onSelect={jest.fn()} />);
    expect(screen.queryByTestId('region-rail-indicator')).toBeNull();
  });

  it('bấm một đoạn gọi onSelect với đúng key', async () => {
    const onSelect = jest.fn();
    await renderWithTheme(<RegionRail items={ITEMS} selected="north" onSelect={onSelect} />);

    await fireEvent.press(screen.getByText('South'));
    expect(onSelect).toHaveBeenCalledWith('south');
  });
});
