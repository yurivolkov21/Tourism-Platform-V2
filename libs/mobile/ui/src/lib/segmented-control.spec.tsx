import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { SegmentedControl } from './segmented-control';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
] as const;

/** Khối trượt chỉ vẽ sau khi đo xong bề ngang — Jest không tự bắn `onLayout`. */
async function measure() {
  await fireEvent(screen.getByTestId('segmented-track'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 302, height: 40 } },
  });
}

describe('SegmentedControl', () => {
  it('ô đang chọn: chữ primary-foreground, khối trượt nền primary; ô khác chữ foreground', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <SegmentedControl options={OPTIONS} value="upcoming" onChange={() => {}} />,
    );
    await measure();

    const on = StyleSheet.flatten(screen.getByText('Upcoming').props.style);
    const off = StyleSheet.flatten(screen.getByText('All').props.style);
    expect(on.color).toBe(theme.colors['primary-foreground']);
    expect(off.color).toBe(theme.colors.foreground);
    const indicator = StyleSheet.flatten(screen.getByTestId('segmented-indicator').props.style);
    expect(indicator.backgroundColor).toBe(theme.colors.primary);
  });

  it('cao 40; khối trượt đứng đúng ô chọn và giữ hình ô đó (hai đầu bo 20, giữa vuông)', async () => {
    await renderWithTheme(
      <SegmentedControl options={OPTIONS} value="upcoming" onChange={() => {}} />,
    );
    await measure();

    const indicator = StyleSheet.flatten(screen.getByTestId('segmented-indicator').props.style);
    // Ô giữa: 3 ô, 2 khe 2px → mỗi ô (302 - 4) / 3; ô chọn là ô thứ hai.
    expect(indicator.height).toBe(40);
    expect(indicator.width).toBeCloseTo(298 / 3, 1);
    expect(indicator).toMatchObject({
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    });
  });

  it('ô đầu chọn thì khối trượt bo trái 20, vuông bên phải', async () => {
    await renderWithTheme(<SegmentedControl options={OPTIONS} value="all" onChange={() => {}} />);
    await measure();

    const indicator = StyleSheet.flatten(screen.getByTestId('segmented-indicator').props.style);
    expect(indicator).toMatchObject({ borderTopLeftRadius: 20, borderBottomLeftRadius: 20 });
    expect(indicator.borderTopRightRadius).toBe(0);
  });

  it('ô cuối chọn thì khối trượt bo phải 20, vuông bên trái', async () => {
    await renderWithTheme(<SegmentedControl options={OPTIONS} value="past" onChange={() => {}} />);
    await measure();

    const indicator = StyleSheet.flatten(screen.getByTestId('segmented-indicator').props.style);
    expect(indicator).toMatchObject({ borderTopRightRadius: 20, borderBottomRightRadius: 20 });
    expect(indicator.borderTopLeftRadius).toBe(0);
  });

  it('bấm ô gọi onChange với value; báo trạng thái chọn cho trình đọc màn hình', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<SegmentedControl options={OPTIONS} value="all" onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Past' }));

    expect(onChange).toHaveBeenCalledWith('past');
    expect(screen.getByRole('button', { name: 'All' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});
