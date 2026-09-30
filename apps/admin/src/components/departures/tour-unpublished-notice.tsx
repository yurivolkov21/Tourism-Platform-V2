import { messages } from '@tourism/i18n';
import { Alert, AlertDescription, AlertTitle } from '@tourism/ui/components/alert';
import { EyeOffIcon } from 'lucide-react';
import Link from 'next/link';

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
 *
 * Chỉ báo khi server nói RÕ `false`. Trong vài phút giữa hai lần deploy, admin
 * mới có thể đọc API cũ chưa có field này; coi "không biết" là "chưa đăng" thì
 * mọi tour đang bán đều hiện câu báo sai (vòng review F16).
 *
 * `reviewHref`: bước Review & publish — nơi đặt công tắc On sale từ F19, không còn ở
 * phần đầu ngay trên dòng báo này (vòng review F19).
 */
export function TourUnpublishedNotice({
  isPublished,
  reviewHref,
}: {
  isPublished: boolean;
  reviewHref?: string;
}) {
  if (isPublished !== false) return null;

  return (
    <Alert role="status">
      <EyeOffIcon aria-hidden="true" />
      <AlertTitle>{t.title}</AlertTitle>
      <AlertDescription>
        <p>{t.body}</p>
        {reviewHref ? (
          <Link href={reviewHref} className="font-medium underline underline-offset-4">
            {t.link}
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
