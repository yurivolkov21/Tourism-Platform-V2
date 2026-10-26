import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { LargeTitleHeader } from './large-title-header';

describe('LargeTitleHeader', () => {
  it('tiêu đề là chữ display, canh trái, nằm dưới hàng nút cao 64', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<LargeTitleHeader title="Explore tours" />);

    const title = StyleSheet.flatten(screen.getByText('Explore tours').props.style);
    expect(title.fontSize).toBe(theme.type['3xl'].fontSize);
    expect(screen.getByRole('header')).toBeTruthy();
  });

  it('đệm đỉnh luôn 16, có nút hay không — tiêu đề mọi tab cùng độ cao', async () => {
    await renderWithTheme(<LargeTitleHeader title="Saved tours" />);
    expect(screen.getByTestId('large-title-bar').props.style).toMatchObject({ height: 16 });

    await screen.unmount();
    await renderWithTheme(
      <LargeTitleHeader
        title="Explore tours"
        actions={[{ icon: 'sliders', label: 'Filters', onPress: () => {} }]}
      />,
    );
    expect(screen.getByTestId('large-title-bar').props.style).toMatchObject({ height: 16 });
  });

  it('hành động: nút icon bấm được, vùng chạm 48', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <LargeTitleHeader
        title="Explore tours"
        actions={[{ icon: 'sliders', label: 'Filters', onPress }]}
      />,
    );

    const button = screen.getByLabelText('Filters');
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ width: 48, height: 48 });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('badge số 16 nền destructive; số 0 hoặc không có thì ẩn', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <LargeTitleHeader
        title="Explore tours"
        actions={[{ icon: 'sliders', label: 'Filters', onPress: () => {}, badge: 2 }]}
      />,
    );

    const badge = screen.getByTestId('large-title-badge');
    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
      height: 16,
      backgroundColor: theme.colors['destructive-emphasis'],
    });
    expect(screen.getByText('2')).toBeTruthy();

    await screen.unmount();
    await renderWithTheme(
      <LargeTitleHeader
        title="Explore tours"
        actions={[{ icon: 'sliders', label: 'Filters', onPress: () => {}, badge: 0 }]}
      />,
    );
    expect(screen.queryByTestId('large-title-badge')).toBeNull();
  });

  it('có dòng phụ thì hiện dưới tiêu đề', async () => {
    await renderWithTheme(<LargeTitleHeader title="Saved tours" subtitle="3 tours" />);

    expect(screen.getByText('3 tours')).toBeTruthy();
  });
});
