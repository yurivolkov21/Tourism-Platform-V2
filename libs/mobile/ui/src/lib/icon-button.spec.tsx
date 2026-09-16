import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { IconButton } from './icon-button';
import { withAlpha } from './theme';

describe('IconButton', () => {
  it('vùng chạm không nhỏ hơn ngưỡng a11y của token', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<IconButton icon="x" accessibilityLabel="Close" onPress={() => {}} />);

    const button = screen.getByLabelText('Close');
    expect(button.props.style.minWidth).toBeGreaterThanOrEqual(theme.touchTargetMin);
    expect(button.props.style.minHeight).toBeGreaterThanOrEqual(theme.touchTargetMin);
  });

  it('bấm thì gọi onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<IconButton icon="x" accessibilityLabel="Close" onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('Close'));

    expect(onPress).toHaveBeenCalled();
  });

  it('bản đứng trên ảnh có nền mờ suy từ token scrim', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(
      <IconButton icon="arrow-left" accessibilityLabel="Back" variant="glass" onPress={() => {}} />,
      'dark',
    );

    expect(screen.getByLabelText('Back').props.style.backgroundColor).toBe(
      withAlpha(theme.colors.scrim, 0.45),
    );
  });

  it('bản thường trong suốt, không mang nền nào', async () => {
    await renderWithTheme(
      <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={() => {}} />,
    );

    expect(screen.getByLabelText('Back').props.style.backgroundColor).toBeUndefined();
  });
});
