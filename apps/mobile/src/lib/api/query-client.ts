import { ORPCError } from '@orpc/client';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/** Trần số lần gọi lại — giữ đúng mặc định 3 của TanStack Query. */
const MAX_QUERY_RETRIES = 3;

/**
 * Có gọi lại một query vừa hỏng không. Lỗi 4xx của server là câu trả lời chắc
 * chắn (tour đã gỡ, bài viết không tồn tại, input sai): gọi lại vẫn ra đúng lỗi
 * đó, chỉ bắt khách nhìn vòng xoay thêm 1 + 2 + 4 giây backoff trước khi thấy
 * màn "không còn nữa". Trừ 401 (phiên có thể vừa kịp nạp cookie), 408 và 429
 * (tạm thời). Lỗi mạng, hết giờ chờ (API trên Render ngủ dậy chậm) và 5xx vẫn
 * gọi lại như mặc định.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  if (error instanceof ORPCError) {
    const { status } = error;
    const clientError = status >= 400 && status < 500;
    if (clientError && status !== 401 && status !== 408 && status !== 429) return false;
  }
  return true;
}

/**
 * Một instance DUY NHẤT ở module scope — dựng lại trong thân render sẽ xoá
 * cache mỗi lần RootLayout render lại (cùng lý do `authActions` ở _layout.tsx
 * dựng ở module scope, không trong thân component).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      // Dữ liệu tour/danh sách đổi chậm: trong 30 giây mở lại tab hay màn đã xem thì dùng cache,
      // không gọi lại API và không nháy loading. Query nào cần luôn mới tự đặt `staleTime: 0`
      // (vd `bookings/[code]`); đơn hàng/ví yêu thích đổi xong đã tự `invalidateQueries`.
      staleTime: 30_000,
      // Giữ cache 10 phút sau khi rời màn (mặc định 5) để quay lại vẫn có dữ liệu cũ hiện ngay.
      gcTime: 10 * 60_000,
    },
  },
});

/**
 * React Native không có sự kiện focus của cửa sổ nên `refetchOnWindowFocus` của react-query
 * không bao giờ chạy. Nối nó với `AppState`: app quay lại tiền cảnh (vd khách thanh toán xong
 * trên trình duyệt rồi trở về) thì mọi query đang hiện và đã cũ tự tải lại.
 */
export function bindAppStateFocus(): () => void {
  if (Platform.OS === 'web') return () => {};
  const subscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
  return () => subscription.remove();
}
