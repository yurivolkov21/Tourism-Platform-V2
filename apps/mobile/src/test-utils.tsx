import { render } from '@testing-library/react-native';
import { buildTheme, type ColorScheme, ThemeProvider } from '@tourism/mobile-ui';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { type AuthActions, AuthActionsProvider } from '@/features/auth/auth-actions';
import { createMockAuthActions } from '@/features/auth/mock-auth-actions';

// Tiện ích DÙNG CHO TEST của app mobile — cùng khuôn với `test-utils` của
// `@tourism/mobile-ui`, chỉ thêm provider auth vì màn ở đây có thể gọi
// `useAuthActions()`.

// Số đo của một máy tầm trung có tai thỏ: `SafeAreaView` cần metrics thật, không
// thì nó treo chờ đo và test không bao giờ render xong.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export interface RenderOptions {
  /** Thay bản giả lập mặc định để dựng đúng nhánh kịch bản cần thử. */
  actions?: AuthActions;
}

/** Render một component trong đúng bối cảnh mà app thật cho nó. */
export function renderWithTheme(
  ui: ReactElement,
  scheme: ColorScheme = 'light',
  { actions = createMockAuthActions({ delayMs: 0 }) }: RenderOptions = {},
) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider scheme={scheme}>
        <AuthActionsProvider value={actions}>{ui}</AuthActionsProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Theme mà `renderWithTheme` đang dùng — để spec đối chiếu giá trị token. */
export const themeFor = (scheme: ColorScheme = 'light') => buildTheme(scheme);
