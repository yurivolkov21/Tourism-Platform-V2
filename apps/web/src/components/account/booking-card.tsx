import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import Link from 'next/link';
import { daysUntilDeparture } from '@/lib/account-stats';
import { bookingView } from '@/lib/booking-vm';
import { formatDateRange, formatMoney } from '@/lib/tours';

/**
 * Gợi ý "còn mấy hôm nữa xong" — CHỈ dùng cho nhóm "đang đi".
 *
 * Ở các nhóm khác nó vô nghĩa hoặc gây hiểu nhầm: chuyến chưa khởi hành mà
 * ghi "ends in 3 days" thì người đọc tưởng sắp hết hạn gì đó.
 */
function endsHint(endDate: string): string {
  const t = messages.accountBookings;
  const days = daysUntilDeparture(endDate);
  if (days <= 0) return t.endsToday;
  if (days === 1) return t.endsTomorrow;
  return t.endsInDays(days);
}

/**
 * Một DÒNG trong cột phải của `/account/bookings` (redesign 11/08).
 *
 * Khuôn lấy từ mẫu Airbnb "Personal info" và shadcn-studio 07: nhãn + dòng phụ
 * bên trái, giá trị bám ĐÚNG mép phải container, hairline ngăn từng dòng.
 * Không viền, không bo góc, không nền riêng — tấm sheet `rounded-2xl border
 * bg-card` của bản trước tự đẻ ra hai mép x không nằm trong lưới ba toạ độ.
 *
 * PILL TRẠNG THÁI BỊ BỎ, và đây là vá một lỗi WCAG có thật chứ không phải đổi
 * gu: `TONE_CLASS.warning` là `bg-warning/10 text-warning`, mà `warning` trên
 * nền ở chế độ SÁNG đo được 1.90:1 — pill "Awaiting payment" gần như vô hình.
 * Thay bằng nhãn mono chữ hoa: `foreground` (13.78/11.73) cho trạng thái CẦN
 * LÀM GÌ ĐÓ, `muted-foreground` (6.24/6.66) cho trạng thái đã yên. Cả hai đều
 * qua 4.5:1 ở cả hai chế độ màu, và độ đậm nhạt mang đúng nghĩa "còn việc hay
 * xong rồi".
 */
export function BookingCard({
  booking,
  showEndsHint,
}: {
  booking: Booking;
  showEndsHint?: boolean;
}) {
  const t = messages.accountBookings;
  const view = bookingView(booking);
  // `warning` là tone của các trạng thái còn treo việc (chưa trả tiền). Chỉ
  // nhóm đó mới được nổi lên; còn lại lùi về muted.
  const needsAction = view.tone === 'warning';

  return (
    <li>
      <Link
        href={`/account/bookings/${booking.code}`}
        // `-mx-2 px-2` để nền hover thở ra hai bên mà CHỮ vẫn đứng đúng mép
        // lưới — nếu thêm padding thật thì dòng thụt vào và sinh toạ độ thứ tư.
        className="-mx-2 flex flex-col gap-1 rounded-md px-2 py-4 outline-ring transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {booking.tourTitle}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground tabular-nums">
            <span className="font-mono text-xs">{booking.code}</span>
            {' · '}
            {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
            {showEndsHint ? ` · ${endsHint(booking.departureEndDate)}` : null}
            {' · '}
            {t.travellers(booking.numAdults, booking.numChildren)}
          </span>
        </span>

        <span className="shrink-0 sm:text-right">
          <span className="block text-sm font-medium text-foreground tabular-nums">
            {formatMoney(booking.totalAmount, booking.currency)}
          </span>
          <span
            className={`mt-0.5 block font-mono text-[0.625rem] tracking-[0.16em] uppercase ${
              needsAction ? 'font-medium text-foreground' : 'text-muted-foreground'
            }`}
          >
            {messages.booking.list.status[booking.status]}
          </span>
        </span>
      </Link>
    </li>
  );
}
