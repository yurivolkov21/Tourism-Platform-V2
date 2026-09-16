import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { TextField } from './text-field';

describe('TextField', () => {
  it('ô trống thì nhãn đứng làm placeholder', async () => {
    await renderWithTheme(<TextField label="Email" value="" onChangeText={() => {}} />);

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    // Nhãn thu nhỏ chưa xuất hiện: lúc rỗng chỉ có một chỗ đọc được tên ô.
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('ô có giá trị thì nhãn thu nhỏ hiện lên trên', async () => {
    await renderWithTheme(
      <TextField label="Email" value="lan.nguyen@example.com" onChangeText={() => {}} />,
    );

    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByDisplayValue('lan.nguyen@example.com')).toBeTruthy();
  });

  it('có lỗi thì in câu lỗi, đổi màu gạch chân và đánh dấu ô sai', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(
      <TextField
        label="Email"
        value="lan.nguyen@"
        error="Enter a valid email address."
        onChangeText={() => {}}
      />,
      'dark',
    );

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByDisplayValue('lan.nguyen@').props['aria-invalid']).toBe(true);
    expect(screen.getByTestId('text-field-line').props.style.borderBottomColor).toBe(
      theme.colors['destructive-emphasis'],
    );
  });

  it('ô mật khẩu che chữ, nút hiện/ẩn đổi cả trạng thái lẫn nhãn', async () => {
    await renderWithTheme(
      <TextField
        label="Password"
        value="correct-horse"
        secure
        revealLabel="Show password"
        hideLabel="Hide password"
        onChangeText={() => {}}
      />,
    );

    expect(screen.getByDisplayValue('correct-horse').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText('Show password'));
    // RNTL 14 render bất đồng bộ: phải đợi lần vẽ lại rồi mới soi prop, không thì
    // đọc trúng cây cũ (cùng bẫy đã ghi ở runbook mobile-dev-loop §6).
    await screen.findByLabelText('Hide password');
    expect(screen.getByDisplayValue('correct-horse').props.secureTextEntry).toBe(false);
  });

  it('không có lỗi thì gạch chân dùng màu viền bình thường', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(<TextField label="Email" value="" onChangeText={() => {}} />, 'dark');

    expect(screen.getByTestId('text-field-line').props.style.borderBottomColor).toBe(
      theme.colors.border,
    );
  });
});
