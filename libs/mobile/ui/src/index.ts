// Bề mặt công khai của @tourism/mobile-ui. App mobile chỉ import từ đây —
// không với tay vào `src/lib/*` (ranh giới package, ADR-0040 §2).

export type { AppTextProps, AppTextTone, AppTextVariant } from './lib/app-text';
export { APP_TEXT_VARIANTS, AppText } from './lib/app-text';
export type { ButtonProps, ButtonVariant } from './lib/button';
export { BUTTON_VARIANTS, Button } from './lib/button';
export type { CardProps } from './lib/card';
export { Card } from './lib/card';
export type { EmptyStateProps } from './lib/empty-state';
export { EmptyState } from './lib/empty-state';
export type { ScreenEdge, ScreenProps } from './lib/screen';
export { SCREEN_EDGES_UNDER_HEADER, SCREEN_EDGES_UNDER_TABS, Screen } from './lib/screen';
export type { ColorScheme, FontWeight, MobileColorKey, MobileTheme } from './lib/theme';
export { buildTheme, MOBILE_COLOR_KEYS } from './lib/theme';
export type { ThemeProviderProps } from './lib/theme-provider';
export { ThemeProvider, useTheme } from './lib/theme-provider';
