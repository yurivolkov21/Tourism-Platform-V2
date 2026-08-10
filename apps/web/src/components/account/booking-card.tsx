import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import Link from 'next/link';
import { daysUntilDeparture } from '@/lib/account-stats';
import { TONE_CLASS } from '@/lib/booking-tone';
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
 * Một DÒNG trong sheet `/account/bookings` (redesign 10/08).
 *
 * Trước đây mỗi booking là một card có viền riêng; xếp cạnh nhau chúng đọc
 * thành một chồng hộp chứ không thành một bảng. Nay các dòng nằm chung trong
 * một tấm sheet do trang dựng, ngăn nhau bằng hairline — nên component này
 * KHÔNG tự vẽ viền hay bo góc nữa.
 *
 * Bỏ luôn affordance "View details" ở cuối: cả dòng đã là một link, thêm một
 * nhãn nói lại điều đó chỉ tốn chỗ.
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

  return (
    <li>
      <Link
        href={`/account/bookings/${booking.code}`}
        className="flex flex-col gap-3 p-4 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{booking.code}</span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">{booking.tourTitle}</span>
          <span className="block text-sm text-muted-foreground tabular-nums">
            {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
            {showEndsHint ? ` · ${endsHint(booking.departureEndDate)}` : null}
            {' · '}
            {t.travellers(booking.numAdults, booking.numChildren)}
          </span>
        </span>

        <span
          className={`shrink-0 self-start rounded-full px-2.5 py-0.5 text-xs font-medium sm:self-auto ${TONE_CLASS[view.tone]}`}
        >
          {messages.booking.list.status[booking.status]}
        </span>

        <span className="shrink-0 font-medium tabular-nums text-foreground sm:w-24 sm:text-right">
          {formatMoney(booking.totalAmount, booking.currency)}
        </span>
      </Link>
    </li>
  );
}
