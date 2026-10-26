import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { FloatingTabBar } from './floating-tab-bar';

function setup(index: number) {
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const routes = [
    { key: 'a', name: 'index' },
    { key: 'b', name: 'explore' },
  ];
  const descriptors = Object.fromEntries(
    routes.map((r) => [
      r.key,
      {
        options: {
          title: r.name === 'index' ? 'Home' : 'Explore',
          tabBarIcon: () => <Text>i</Text>,
        },
      },
    ]),
  );
  return {
    navigate,
    emit,
    ui: (
      <FloatingTabBar
        state={{ index, routes }}
        descriptors={descriptors}
        navigation={{ navigate, emit }}
      />
    ),
  };
}

describe('FloatingTabBar', () => {
  it('tab đang chọn: viên chỉ báo nền secondary hiện đủ, tab kia ẩn', async () => {
    const theme = themeFor('light');
    await renderWithTheme(setup(0).ui);
    const on = StyleSheet.flatten(screen.getByTestId('tab-indicator-index').props.style);
    const off = StyleSheet.flatten(screen.getByTestId('tab-indicator-explore').props.style);
    expect(on.backgroundColor).toBe(theme.colors.secondary);
    expect(on.opacity).toBe(1);
    expect(off.opacity).toBe(0);
  });

  it('nhãn luôn hiện cho mọi tab', async () => {
    await renderWithTheme(setup(0).ui);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Explore')).toBeTruthy();
  });

  it('bấm tab khác điều hướng; bấm tab đang mở chỉ bắn tabPress', async () => {
    const s = setup(0);
    await renderWithTheme(s.ui);
    await fireEvent.press(screen.getByLabelText('Explore'));
    expect(s.navigate).toHaveBeenCalledWith('explore');
    s.navigate.mockClear();
    await fireEvent.press(screen.getByLabelText('Home'));
    expect(s.emit).toHaveBeenCalledTimes(2);
    expect(s.navigate).not.toHaveBeenCalled();
  });
});
