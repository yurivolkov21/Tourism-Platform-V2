import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme } from '../test-utils';
import { Button } from './button';

// Giả lập đúng kịch bản "nâng --touch-target-min lên 48px": token đổi, còn số
// 46dp lấy từ `.btn` của bản vẽ giữ nguyên. File riêng vì `jest.mock` áp cho cả
// file — spec chính của Button cần token thật.
jest.mock('./theme', () => {
  const actual = jest.requireActual<typeof import('./theme')>('./theme');
  return {
    ...actual,
    buildTheme: (...[scheme, source = {}]: Parameters<typeof actual.buildTheme>) =>
      actual.buildTheme(scheme, { ...source, touchTargetMin: 48 }),
  };
});

describe('Button — sàn vùng chạm', () => {
  it('bản pill không bao giờ thấp hơn ngưỡng a11y của token', async () => {
    await renderWithTheme(<Button label="Sign in" shape="pill" onPress={() => {}} />);

    const style = StyleSheet.flatten(screen.getByRole('button').props.style);

    expect(style.minHeight).toBe(48);
  });
});
