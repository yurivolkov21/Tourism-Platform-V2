import { QueryClient } from '@tanstack/react-query';

/**
 * Một instance DUY NHẤT ở module scope — dựng lại trong thân render sẽ xoá
 * cache mỗi lần RootLayout render lại (cùng lý do `authActions` ở _layout.tsx
 * dựng ở module scope, không trong thân component).
 */
export const queryClient = new QueryClient();
