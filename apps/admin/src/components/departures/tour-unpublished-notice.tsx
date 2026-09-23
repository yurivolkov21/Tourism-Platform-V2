import { messages } from '@tourism/i18n';
import { Alert, AlertDescription, AlertTitle } from '@tourism/ui/components/alert';
import { EyeOffIcon } from 'lucide-react';

const t = messages.admin.departures.list.unpublished;

/**
 * Dòng báo đầu màn chuyến khi TOUR chưa đăng (spec F16 §2h).
 *
 * Giai đoạn chỉ tả chuyến, nên một chuyến `on-sale` của tour đang ẩn vẫn mang
 * huy hiệu xanh dù khách không đặt được. Nói điều đó MỘT lần ở đây, thay vì
 * trộn trạng thái tour vào hàm giai đoạn của từng chuyến.
 *
 * `role="status"` ghi đè `role="alert"` mặc định của `Alert`: đây là thông tin
 * có sẵn lúc mở trang chứ không phải sự kiện vừa xảy ra, và `alert` bắt trình
 * đọc màn hình ngắt lời người dùng mỗi lần vào trang.
 */
export function TourUnpublishedNotice({ isPublished }: { isPublished: boolean }) {
  if (isPublished) return null;

  return (
    <Alert role="status">
      <EyeOffIcon aria-hidden="true" />
      <AlertTitle>{t.title}</AlertTitle>
      <AlertDescription>{t.body}</AlertDescription>
    </Alert>
  );
}
