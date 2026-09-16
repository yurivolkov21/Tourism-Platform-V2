import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { OtpInput } from './otp-input';

describe('OtpInput', () => {
  it('bỏ ký tự không phải số và chặn quá độ dài', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <OtpInput value="" accessibilityLabel="Verification code" onChangeText={onChangeText} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Verification code'), '4a8-2 190999');

    expect(onChangeText).toHaveBeenCalledWith('482190');
  });

  it('vẽ đủ sáu ô và in từng chữ số đã nhập', async () => {
    await renderWithTheme(
      <OtpInput value="482" accessibilityLabel="Verification code" onChangeText={() => {}} />,
    );

    expect(screen.getAllByTestId('otp-cell')).toHaveLength(6);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('trạng thái sai đổi màu gạch chân của MỌI ô', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(
      <OtpInput
        value="482190"
        invalid
        accessibilityLabel="Verification code"
        onChangeText={() => {}}
      />,
      'dark',
    );

    const cells = screen.getAllByTestId('otp-cell');
    expect(
      cells.every(
        (cell) => cell.props.style.borderBottomColor === theme.colors['destructive-emphasis'],
      ),
    ).toBe(true);
  });

  it('ô đang nhập được đánh dấu bằng màu nhấn, các ô sau thì không', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(
      <OtpInput value="48" accessibilityLabel="Verification code" onChangeText={() => {}} />,
      'dark',
    );

    const cells = screen.getAllByTestId('otp-cell');
    expect(cells[2]?.props.style.borderBottomColor).toBe(theme.colors['primary-emphasis']);
    expect(cells[5]?.props.style.borderBottomColor).toBe(theme.colors.border);
  });
});
