import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { AppText } from './app-text';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('bấm thì đảo trạng thái và khai đúng cho trình đọc màn hình', async () => {
    const onValueChange = jest.fn();
    await renderWithTheme(
      <Checkbox checked={false} accessibilityLabel="Agree to terms" onValueChange={onValueChange}>
        <AppText variant="caption">I agree to the Terms</AppText>
      </Checkbox>,
    );

    const box = screen.getByLabelText('Agree to terms');
    expect(box.props.accessibilityState).toMatchObject({ checked: false });

    fireEvent.press(box);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('đang tick thì khai checked và vẫn hiện nội dung đi kèm', async () => {
    await renderWithTheme(
      <Checkbox checked accessibilityLabel="Agree to terms" onValueChange={() => {}}>
        <AppText variant="caption">I agree to the Terms</AppText>
      </Checkbox>,
    );

    expect(screen.getByLabelText('Agree to terms').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByText('I agree to the Terms')).toBeTruthy();
  });
});
