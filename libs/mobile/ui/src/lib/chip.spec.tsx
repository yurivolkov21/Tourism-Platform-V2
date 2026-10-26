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
    // KHÔNG gán 'transparent' tường minh — Android vẽ thiếu cạnh đáy viền khi
    // backgroundColor là string 'transparent' kết hợp borderRadius + Pressable
    // (đo được 01/10). Bỏ hẳn property là đúng fix.
    expect(style.backgroundColor).toBeUndefined();
  });

  it('chip cao 32, bo 8, viền 1 (Material 3)', async () => {
    await renderWithTheme(<Chip label="Trekking" />);
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.height).toBe(32);
    expect(style.borderRadius).toBe(8);
    expect(style.borderWidth).toBe(1);
  });

  it('variant "selected": nền secondary, chữ secondary-foreground, kèm dấu tick', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Chip label="Trekking" variant="selected" onPress={() => {}} />);
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.backgroundColor).toBe(theme.colors.secondary);
    const textStyle = StyleSheet.flatten(screen.getByText('Trekking').props.style);
    expect(textStyle.color).toBe(theme.colors['secondary-foreground']);
    expect(screen.getByTestId('chip-check')).toBeTruthy();
  });

  it('chip chưa chọn không có dấu tick', async () => {
    await renderWithTheme(<Chip label="Trekking" onPress={() => {}} />);
    expect(screen.queryByTestId('chip-check')).toBeNull();
  });

  it('variant "removable": nền/viền secondary, có nút x gọi onRemove', async () => {
    const theme = themeFor('light');
    const onRemove = jest.fn();
    await renderWithTheme(
      <Chip
        label="Trekking"
        variant="removable"
        onRemove={onRemove}
        removeLabel="Remove filter Trekking"
      />,
    );
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.backgroundColor).toBe(theme.colors.secondary);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove filter Trekking' }));
    expect(onRemove).toHaveBeenCalled();
  });

  // L4 (review nhánh account): nhãn nút x phải do app truyền vào (copy nằm ở
  // `@tourism/i18n`, luật 7) — package UI không tự ghép chuỗi tiếng Anh.
  it('nhãn nút x lấy nguyên văn từ prop removeLabel', async () => {
    await renderWithTheme(
      <Chip label="Hội An" variant="removable" onRemove={jest.fn()} removeLabel="Xoá Hội An" />,
    );

    expect(screen.getByRole('button', { name: 'Xoá Hội An' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('bấm chip (không phải nút x) gọi onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Chip label="Trekking" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Trekking'));
    expect(onPress).toHaveBeenCalled();
  });

  // N10 (rà 07/10): chip lọc từng chỉ nói "đang chọn" bằng màu — trình đọc màn hình không biết.
  it('chip bấm được báo trạng thái chọn cho trình đọc màn hình', async () => {
    await renderWithTheme(
      <>
        <Chip label="All" variant="selected" onPress={jest.fn()} />
        <Chip label="Upcoming" onPress={jest.fn()} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'All', selected: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upcoming', selected: false })).toBeTruthy();
  });

  // N10: tag của bài viết là chip KHÔNG có onPress — đọc là "nút" thì mời bấm một thứ không làm gì.
  it('chip không có onPress là nhãn tĩnh, không phải nút', async () => {
    await renderWithTheme(<Chip label="Culture" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Culture')).toBeTruthy();
  });
});
