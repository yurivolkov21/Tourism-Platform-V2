import { screen } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { TopoPattern } from './topo-pattern';

describe('TopoPattern', () => {
  it('phủ kín cha, mờ theo opacity, nhuộm màu foreground của theme', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(<TopoPattern opacity={0.1} />, 'dark');

    const pattern = screen.getByTestId('topo-pattern');
    expect(StyleSheet.flatten(pattern.props.style)).toMatchObject({
      position: 'absolute',
      opacity: 0.1,
    });
    // expo-image chuyển màu sang số nguyên native trước khi tới host view.
    expect(pattern.props.tintColor).toBe(processColor(theme.colors.foreground));
  });
});
