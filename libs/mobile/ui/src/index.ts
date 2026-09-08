// Bề mặt công khai của @tourism/mobile-ui. App mobile chỉ import từ đây —
// không với tay vào `src/lib/*` (ranh giới package, ADR-0040 §2).

export type { ColorScheme, MobileColorKey, MobileTheme } from './lib/theme';
export { buildTheme, MOBILE_COLOR_KEYS } from './lib/theme';
export type { ThemeProviderProps } from './lib/theme-provider';
export { ThemeProvider, useTheme } from './lib/theme-provider';
