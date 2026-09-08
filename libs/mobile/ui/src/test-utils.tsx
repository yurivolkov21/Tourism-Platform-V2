// Tiện ích DÙNG CHO TEST của @tourism/mobile-ui — cố ý nằm ngoài `src/lib` để
// spec canh tokens-only không quét nó và để không lẫn vào bề mặt công khai
// (`src/index.ts` không export gì từ đây).
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { buildTheme, type ColorScheme } from './lib/theme';
import { ThemeProvider } from './lib/theme-provider';

// Số đo của một máy tầm trung có tai thỏ — `SafeAreaView` cần metrics thật,
// không thì nó treo chờ đo và test không bao giờ render xong.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Render một component trong đúng bối cảnh mà app thật cho nó. */
export function renderWithTheme(ui: ReactElement, scheme: ColorScheme = 'light') {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider scheme={scheme}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Theme mà `renderWithTheme` đang dùng — để spec đối chiếu giá trị token. */
export const themeFor = (scheme: ColorScheme = 'light') => buildTheme(scheme);
