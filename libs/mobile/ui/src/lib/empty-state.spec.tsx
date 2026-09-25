import { screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('hiện tiêu đề và câu mô tả', async () => {
    await renderWithTheme(<EmptyState title="Nothing saved yet" body="Tap the heart." />);

    expect(screen.getByText('Nothing saved yet')).toBeTruthy();
    expect(screen.getByText('Tap the heart.')).toBeTruthy();
  });

  it('bỏ được câu mô tả', async () => {
    await renderWithTheme(<EmptyState title="Nothing saved yet" />);

    expect(screen.getByText('Nothing saved yet')).toBeTruthy();
    expect(screen.queryByText('Tap the heart.')).toBeNull();
  });

  it('câu mô tả dùng màu muted của token, tiêu đề dùng foreground', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<EmptyState title="Trống" body="Chưa có gì." />);

    const title = StyleSheet.flatten(screen.getByText('Trống').props.style);
    const body = StyleSheet.flatten(screen.getByText('Chưa có gì.').props.style);
    expect(title.color).toBe(theme.colors.foreground);
    expect(body.color).toBe(theme.colors['muted-foreground']);
  });

  it('dựng trên nền thẻ — nền và bo góc lấy từ token', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<EmptyState testID="empty" title="Trống" />);

    const style = StyleSheet.flatten(screen.getByTestId('empty').props.style);
    expect(style.backgroundColor).toBe(theme.colors.card);
    expect(style.borderRadius).toBe(theme.radius.base);
    expect(style.alignItems).toBe('center');
  });

  it('surface=false: không nền thẻ, không viền — tri-state chiếm trọn vùng còn lại (H2–H4, E5)', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<EmptyState testID="empty" title="Trống" surface={false} />);

    const style = StyleSheet.flatten(screen.getByTestId('empty').props.style);
    expect(style.backgroundColor).not.toBe(theme.colors.card);
    expect(style.borderWidth).toBeFalsy();
    expect(style.alignItems).toBe('center');
  });

  it('có khe cho hành động đi kèm', async () => {
    await renderWithTheme(
      <EmptyState title="Trống">
        <Text>Browse tours</Text>
      </EmptyState>,
    );

    expect(screen.getByText('Browse tours')).toBeTruthy();
  });

  it('vẽ icon khi có truyền, không vẽ gì thêm khi không truyền (hợp đồng cũ không đổi)', async () => {
    // Ghi chú: dùng hai lần renderWithTheme độc lập thay vì rerender() của
    // lần render đầu — renderWithTheme tự bọc ThemeProvider/SafeAreaProvider
    // quanh `ui` thay vì dùng option `wrapper` của RTL, nên rerender(uiMới)
    // thay hẳn cây gốc và làm mất provider (useTheme() ném lỗi). Đây là giới
    // hạn có sẵn của test-utils.tsx, ngoài phạm vi sửa của task này; hai lần
    // render riêng vẫn kiểm đúng hợp đồng: có icon thì vẽ, không có thì không.
    const { queryByTestId: withIcon } = await renderWithTheme(
      <EmptyState title="Không có gì" icon={<Text testID="empty-icon">★</Text>} />,
    );
    expect(withIcon('empty-icon')).toBeTruthy();

    const { queryByTestId: withoutIcon } = await renderWithTheme(
      <EmptyState title="Không có gì" />,
    );
    expect(withoutIcon('empty-icon')).toBeNull();
  });
});
