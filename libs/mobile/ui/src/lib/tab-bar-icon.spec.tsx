import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { TabBarIcon } from './tab-bar-icon';

describe('TabBarIcon', () => {
  it('focused=false: không viên nền', async () => {
    await renderWithTheme(<TabBarIcon name="home" focused={false} />);
    const style = StyleSheet.flatten(screen.getByTestId('tab-bar-icon-pill').props.style);
    expect(style.backgroundColor).toBe('transparent');
  });

  it('focused=true: viên nền primary', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<TabBarIcon name="home" focused />);
    const style = StyleSheet.flatten(screen.getByTestId('tab-bar-icon-pill').props.style);
    expect(style.backgroundColor).toBe(theme.colors.primary);
  });
});
