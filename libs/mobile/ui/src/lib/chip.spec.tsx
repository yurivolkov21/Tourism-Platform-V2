import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { Chip } from './chip';

describe('Chip', () => {
  it('variant "default": viền border, nền trong suốt', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Chip label="Trekking" />);
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.borderColor).toBe(theme.colors.border);
    expect(style.backgroundColor).toBe('transparent');
  });

  it('variant "selected": nền/viền primary, chữ primary-foreground', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Chip label="Trekking" variant="selected" />);
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.backgroundColor).toBe(theme.colors.primary);
    const textStyle = StyleSheet.flatten(screen.getByText('Trekking').props.style);
    expect(textStyle.color).toBe(theme.colors['primary-foreground']);
  });

  it('variant "removable": nền/viền secondary, có nút x gọi onRemove', async () => {
    const theme = themeFor('light');
    const onRemove = jest.fn();
    await renderWithTheme(<Chip label="Trekking" variant="removable" onRemove={onRemove} />);
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.backgroundColor).toBe(theme.colors.secondary);

    await fireEvent.press(screen.getByRole('button', { name: /remove trekking/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('bấm chip (không phải nút x) gọi onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Chip label="Trekking" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Trekking'));
    expect(onPress).toHaveBeenCalled();
  });
});
