import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { TextField } from './text-field';

/** Viền đổi màu có tween ~160ms nên đọc ra dạng `rgba(...)` và có thể đang lưng chừng — so qua `processColor`, chờ tween xong. */
async function expectBorderColor(expected: string) {
  await waitFor(() => {
    const { borderColor } = StyleSheet.flatten(
      screen.getByTestId('text-field-outline').props.style,
    );
    expect(processColor(borderColor)).toBe(processColor(expected));
  });
}

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

  it('có lỗi thì in câu lỗi, viền 2 màu destructive-emphasis và đánh dấu ô sai', async () => {
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
    expect(StyleSheet.flatten(screen.getByTestId('text-field-outline').props.style)).toMatchObject({
      borderWidth: 2,
    });
    await expectBorderColor(theme.colors['destructive-emphasis']);
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

  it('ô outlined: cao 56, bo 4, viền 1 màu input', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(<TextField label="Email" value="" onChangeText={() => {}} />, 'dark');

    expect(StyleSheet.flatten(screen.getByTestId('text-field-outline').props.style)).toMatchObject({
      minHeight: 56,
      borderRadius: 4,
      borderWidth: 1,
    });
    await expectBorderColor(theme.colors.input);
  });

  it('đang gõ thì viền 2 màu primary-emphasis và nhãn nổi lên đường viền', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(<TextField label="Email" value="" onChangeText={() => {}} />, 'dark');

    await fireEvent(screen.getByLabelText('Email'), 'focus');

    await screen.findByText('Email');
    expect(StyleSheet.flatten(screen.getByTestId('text-field-outline').props.style)).toMatchObject({
      borderWidth: 2,
    });
    await expectBorderColor(theme.colors['primary-emphasis']);
  });

  it('nhãn nổi nằm trên đường viền, nền che mặc định là background', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<TextField label="Email" value="a@b.c" onChangeText={() => {}} />);

    expect(StyleSheet.flatten(screen.getByTestId('text-field-label').props.style)).toMatchObject({
      position: 'absolute',
      top: -8,
      backgroundColor: theme.colors.background,
    });
  });

  it('nền che nhãn nhận từ prop để trùng mặt phía sau (bottom sheet…)', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <TextField
        label="Email"
        value="a@b.c"
        labelBackground={theme.surfaces.container}
        onChangeText={() => {}}
      />,
    );

    expect(StyleSheet.flatten(screen.getByTestId('text-field-label').props.style)).toMatchObject({
      backgroundColor: theme.surfaces.container,
    });
  });

  it('icon trần, không còn khung boxed', async () => {
    await renderWithTheme(
      <TextField label="Display name" icon="user" value="" onChangeText={() => {}} />,
    );
    expect(screen.queryByTestId('text-field-icon-box')).toBeNull();
  });

  it('tall: ô cao 96 và icon neo lên đầu', async () => {
    await renderWithTheme(
      <TextField
        label="Anything we should know?"
        icon="message-square"
        multiline
        tall
        value=""
        onChangeText={() => {}}
      />,
      'dark',
    );
    expect(StyleSheet.flatten(screen.getByTestId('text-field-outline').props.style)).toMatchObject({
      alignItems: 'flex-start',
      minHeight: 96,
    });
    expect(screen.getByLabelText('Anything we should know?').props.multiline).toBe(true);
  });

  it('multiline KHÔNG tall: TextInput nhận multiline, ô cao 56 và canh giữa', async () => {
    await renderWithTheme(
      <TextField
        label="Reason (optional)"
        icon="message-square"
        multiline
        value=""
        onChangeText={() => {}}
      />,
      'dark',
    );
    expect(StyleSheet.flatten(screen.getByTestId('text-field-outline').props.style)).toMatchObject({
      alignItems: 'center',
      minHeight: 56,
    });
    expect(screen.getByLabelText('Reason (optional)').props.multiline).toBe(true);
  });
});
