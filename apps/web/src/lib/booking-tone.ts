import type { BookingViewTone } from '@/lib/booking-vm';

/**
 * Class cho pill trạng thái booking, tra theo `tone` của `bookingView`.
 *
 * Vì sao ở LIB chứ không ở component: trước đây hằng này được export từ
 * `account-dashboard.tsx`, và cả `booking-card.tsx` lẫn trang chi tiết booking
 * import NGƯỢC từ đó — tức một component màn hình đang đóng vai module dùng
 * chung. Viết lại dashboard là kéo theo hai chỗ kia vỡ mà không có lý do gì
 * ngoài chuyện đặt file sai chỗ.
 *
 * Đây là dữ liệu thuần, không phải component, nên cả Server lẫn Client
 * Component đều import được.
 */
export const TONE_CLASS: Record<BookingViewTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/10 text-destructive',
};
