import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { buildTheme, type ColorScheme, type MobileTheme } from './theme';

// `null` phân biệt "chưa có provider" với một theme hợp lệ — nhờ vậy `useTheme`
// báo được đúng lỗi thay vì trả về undefined rồi nổ ở chỗ khác.
const ThemeContext = createContext<MobileTheme | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /**
   * Ép một chế độ màu, bỏ qua hệ điều hành. Dùng cho test và cho màn nào cố ý
   * một chế độ (vd trang ảnh nền tối); bình thường để trống.
   */
  scheme?: ColorScheme;
}

/**
 * Nguồn theme duy nhất của app mobile. Đây là chỗ DUY NHẤT `@tourism/tokens/theme`
 * được import (ADR-0040 §3) — mọi component lấy màu/chữ qua `useTheme()`.
 */
export function ThemeProvider({ children, scheme }: ThemeProviderProps) {
  // RN 0.86 trả `'unspecified'` khi hệ chưa báo chế độ — quy về sáng.
  const systemScheme = useColorScheme();
  const active: ColorScheme = scheme ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(active), [active]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Đọc theme hiện hành. Ném lỗi nếu component nằm ngoài `<ThemeProvider>`. */
export function useTheme(): MobileTheme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error(
      '@tourism/mobile-ui: useTheme() phải được gọi bên trong <ThemeProvider>. ' +
        'Bọc cây route ở src/app/_layout.tsx.',
    );
  }
  return theme;
}
