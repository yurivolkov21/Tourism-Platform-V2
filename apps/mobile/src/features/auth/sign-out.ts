import type { QueryClient } from '@tanstack/react-query';

/**
 * Đăng xuất + xoá TOÀN BỘ cache TanStack Query (F8, review 06/10). Dùng chung
 * cho mọi đường kết thúc phiên: nút Sign out (A5) và xoá tài khoản (A7).
 *
 * Thiếu bước xoá cache thì `queryClient` (module scope, sống suốt app) giữ
 * nguyên `wishlist.*`/`bookings.*` của người cũ — người đăng nhập sau thấy
 * thoáng dữ liệu đó trước khi refetch về. Xoá HAI lần: trước để màn không vẽ
 * lại dữ liệu cũ trong lúc chờ server, sau để dọn query nào lỡ refetch về
 * (bằng cookie cũ) trong lúc `signOut()` còn chạy.
 *
 * Không ném: mất mạng lúc đăng xuất thì phiên trong expo-secure-store vẫn bị
 * `signOut()` xoá cục bộ trước khi gọi server — khách coi như đã đăng xuất.
 */
export async function signOutAndClearCache(
  signOut: () => Promise<unknown>,
  queryClient: QueryClient,
): Promise<void> {
  queryClient.clear();
  try {
    await signOut();
  } catch {
    // Xem JSDoc — phần cục bộ đã xoá, không có gì để báo lại.
  } finally {
    queryClient.clear();
  }
}
