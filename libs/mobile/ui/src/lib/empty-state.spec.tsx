import { screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('hiện tiêu đề và câu mô tả', async () => {
    await renderWithTheme(<EmptyState title="Nothing saved yet" body="Tap the heart." />);

    expect(screen.getByText('Nothing saved yet')).toBeTruthy();
    expect(screen.getByText('Tap the heart.')).toBeTruthy();
  });

  it('bỏ được câu mô tả', async () => {
    await renderWithTheme(<EmptyState title="Nothing saved yet" />);

    expect(screen.getByText('Nothing saved yet')).toBeTruthy();
    expect(screen.queryByText('Tap the heart.')).toBeNull();
  });

  it('câu mô tả dùng màu muted của token, tiêu đề dùng foreground', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<EmptyState title="Trống" body="Chưa có gì." />);

    const title = StyleSheet.flatten(screen.getByText('Trống').props.style);
    const body = StyleSheet.flatten(screen.getByText('Chưa có gì.').props.style);
    expect(title.color).toBe(theme.colors.foreground);
    expect(body.color).toBe(theme.colors['muted-foreground']);
  });

  it('dựng trên nền thẻ — nền và bo góc lấy từ token', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<EmptyState testID="empty" title="Trống" />);

    const style = StyleSheet.flatten(screen.getByTestId('empty').props.style);
    expect(style.backgroundColor).toBe(theme.colors.card);
    expect(style.borderRadius).toBe(theme.radius.base);
    expect(style.alignItems).toBe('center');
  });

  it('có khe cho hành động đi kèm', async () => {
    await renderWithTheme(
      <EmptyState title="Trống">
        <Text>Browse tours</Text>
      </EmptyState>,
    );

    expect(screen.getByText('Browse tours')).toBeTruthy();
  });
});
