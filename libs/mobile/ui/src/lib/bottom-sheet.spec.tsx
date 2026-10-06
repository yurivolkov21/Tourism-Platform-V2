import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { renderWithTheme } from '../test-utils';
import { BottomSheet, shouldDismissDrag } from './bottom-sheet';
import { ThemeProvider } from './theme-provider';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * `renderWithTheme(...).rerender(...)` MẤT provider (ghi chú đã có ở
 * `empty-state.spec.tsx`: nó bọc Provider quanh `ui` thay vì dùng option
 * `wrapper` của RTL, nên `rerender` thay hẳn cây gốc). Test dưới đây cần
 * rerender THẬT (đổi `visible` trên CÙNG một instance) nên tự bọc Provider ở
 * cả hai lượt gọi thay vì qua `renderWithTheme`.
 */
function renderWithProviders(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider scheme="light">{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('shouldDismissDrag', () => {
  it('kéo quá 100dp thì đóng dù thả chậm', () => {
    expect(shouldDismissDrag(101, 0)).toBe(true);
    expect(shouldDismissDrag(100, 0)).toBe(false);
  });

  it('vẩy đủ nhanh (>0.5dp/ms) thì đóng dù chưa kéo xa', () => {
    expect(shouldDismissDrag(20, 0.6)).toBe(true);
    expect(shouldDismissDrag(20, 0.4)).toBe(false);
  });
});

describe('BottomSheet', () => {
  it('visible=false không vẽ children', async () => {
    await renderWithTheme(
      <BottomSheet visible={false} onClose={jest.fn()}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    expect(screen.queryByText('Filters')).toBeNull();
  });

  it('visible=true vẽ children', async () => {
    await renderWithTheme(
      <BottomSheet visible onClose={jest.fn()}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Filters')).toBeTruthy();
  });

  it('bấm backdrop gọi onClose — bản thân component chỉ theo dõi prop `visible` để tự trượt, không tự ý trễ lời gọi này', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <BottomSheet visible onClose={onClose}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    await fireEvent.press(screen.getByTestId('bottom-sheet-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('cha đổi visible→false: vẫn còn Modal (đang trượt xuống), rồi biến mất sau khi trượt xong', async () => {
    jest.useFakeTimers();
    const { rerender } = await renderWithProviders(
      <BottomSheet visible onClose={jest.fn()}>
        <Text>Filters</Text>
      </BottomSheet>,
    );

    await act(async () => {
      rerender(
        <SafeAreaProvider initialMetrics={METRICS}>
          <ThemeProvider scheme="light">
            <BottomSheet visible={false} onClose={jest.fn()}>
              <Text>Filters</Text>
            </BottomSheet>
          </ThemeProvider>
        </SafeAreaProvider>,
      );
    });
    // Vẫn còn trong cây NGAY sau khi visible tắt — đang giữa chừng trượt xuống.
    expect(screen.getByText('Filters')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Filters')).toBeNull();
    jest.useRealTimers();
  });

  // F3 (review 06/10): tấm có ô nhập (sửa tên, xoá tài khoản, hỏi ngày) bị bàn
  // phím iOS che — `Modal` iOS không tự co theo bàn phím như Android
  // `adjustResize`. `behavior` không lộ ra host View nên test canh hai điều
  // kiện còn lại: nội dung nằm TRONG lớp bọc, và tấm không còn `absolute`
  // (absolute thì không đi theo padding của lớp bọc). Vị trí thật khi bàn
  // phím mở chỉ thấy trên máy.
  it('tấm nằm trong KeyboardAvoidingView, theo luồng bố cục (không absolute)', async () => {
    await renderWithTheme(
      <BottomSheet visible onClose={jest.fn()}>
        <Text testID="sheet-child">Display name</Text>
      </BottomSheet>,
    );

    const avoider = screen.getByTestId('bottom-sheet-keyboard-avoider');
    const child = screen.getByTestId('sheet-child');
    expect(within(avoider).getByTestId('sheet-child')).toBe(child);

    // Mọi tổ tiên từ nội dung lên tới lớp bọc — không cái nào được absolute.
    const positions: unknown[] = [];
    for (let node = child.parent; node !== null && node !== avoider; node = node.parent) {
      positions.push(StyleSheet.flatten(node.props.style)?.position);
    }
    expect(positions.length).toBeGreaterThan(0);
    expect(positions).not.toContain('absolute');
  });
});
