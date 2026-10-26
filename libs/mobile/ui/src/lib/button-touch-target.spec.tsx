import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme } from '../test-utils';
import { Button } from './button';

// Giả lập đúng kịch bản "nâng --touch-target-min lên 64px": token đổi, còn số
// 56dp của nút Material 3 giữ nguyên — sàn a11y của token phải thắng. File riêng vì `jest.mock` áp cho cả
// file — spec chính của Button cần token thật.
jest.mock('./theme', () => {
  const actual = jest.requireActual<typeof import('./theme')>('./theme');
  return {
    ...actual,
    buildTheme: (...[scheme, source = {}]: Parameters<typeof actual.buildTheme>) =>
      actual.buildTheme(scheme, { ...source, touchTargetMin: 64 }),
  };
});

describe('Button — sàn vùng chạm', () => {
  it('nút không bao giờ thấp hơn ngưỡng a11y của token', async () => {
    await renderWithTheme(<Button label="Sign in" onPress={() => {}} />);

    const style = StyleSheet.flatten(screen.getByRole('button').props.style);

    expect(style.minHeight).toBe(64);
  });
});
