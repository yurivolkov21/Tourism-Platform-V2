import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import Link from 'next/link';
import { daysUntilDeparture, todayDateString } from '@/lib/account-stats';
import { bookingView } from '@/lib/booking-vm';
import { formatDateRange } from '@/lib/tours';

/**
 * Một dòng trong "Your journey" (M1) — booking hiển thị như MỘT chặng hành
 * trình: chấm màu theo trạng thái, ảnh nhỏ, title serif, meta một dòng, đúng
 * MỘT động từ bên phải. Mọi phân nhánh đi qua `bookingView` (một nguồn), KHÔNG
 * if/else status thô trong JSX — cùng luật với TripCard cũ mà nó thay thế.
 */

/** Chấm màu theo tone — tra bảng, thiếu tone nào thì rơi về muted. */
const DOT_CLASS: Record<string, string> = {
  success: 'bg-primary',
  warning: 'bg-warning',
  muted: 'bg-muted-foreground opacity-50',
  destructive: 'bg-muted-foreground opacity-50',
};

export function JourneyRow({ booking, today }: { booking: Booking; today?: string }) {
  const t = messages.passportHome;
  const tb = messages.accountBookings;
  const view = bookingView(booking);
  // So CHUỖI ngày UTC (như `account-stats.ts`), KHÔNG parse `Date`: giờ máy
  // xem có thể ở bất kỳ đâu trong ngày, so `Date` với midnight-UTC của
  // ngày booking từng khiến chuyến kết thúc ĐÚNG HÔM NAY bị tính nhầm "đã
  // qua" ngay khi đồng hồ qua khỏi nửa đêm — một luật "đã xong" cho cả trang.
  const now = today ?? todayDateString();
  const started = booking.departureStartDate <= now;
  const ended = booking.departureEndDate < now;
  const detailHref = `/account/bookings/${booking.code}`;

  // Động từ duy nhất bên phải: PENDING → trả tiền; PAID đã đi xong → mời
  // review (anchor thẳng tới form); còn lại → xem chi tiết.
  const action =
    view.actions.includes('payNow') && !ended
      ? { label: t.journeyPayNow, href: detailHref }
      : view.tone === 'success' && ended
        ? { label: t.journeyReview, href: `${detailHref}#review` }
        : { label: t.journeyView, href: detailHref };

  // Mảnh đầu meta: đếm ngược khi chưa đi (mọi trạng thái còn sống), "Ends …"
  // khi PAID đang trên đường — cùng nguồn `inDays`/`endsOn` với Trips cũ.
  const lead =
    view.tone === 'success' && started && !ended
      ? tb.endsOn(formatDateRange(booking.departureEndDate, booking.departureEndDate))
      : !started && (view.tone === 'success' || view.tone === 'warning')
        ? tb.inDays(daysUntilDeparture(booking.departureStartDate))
        : null;

  const statusWord = messages.booking.list.status[booking.status];

  return (
    <div className="flex items-center gap-3.5 border-t border-border/55 py-3.5 first:border-t-0 first:pt-0">
      <span
        aria-hidden="true"
        className={`size-[11px] flex-none rounded-full shadow-[0_0_0_4px_var(--paper)] ${DOT_CLASS[view.tone] ?? 'bg-muted-foreground'}`}
      />
      {booking.tourImage ? (
        // biome-ignore lint/performance/noImgElement: repo không dùng next/image (chưa cấu hình remotePatterns — tiền lệ trip-card/checkout-summary).
        <img
          src={booking.tourImage.url}
          alt={booking.tourImage.alt ?? ''}
          className="h-12 w-16 flex-none rounded-lg object-cover"
        />
      ) : (
        <span aria-hidden="true" className="h-12 w-16 flex-none rounded-lg bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-[15.5px] font-semibold">{booking.tourTitle}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {lead ? `${lead} · ` : ''}
          {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
          {' · '}
          <span className="font-mono text-xs">{booking.code}</span>
          {' · '}
          {statusWord}
        </p>
      </div>
      <Link
        href={action.href}
        className="flex-none text-[13.5px] font-semibold whitespace-nowrap text-primary-emphasis hover:underline"
      >
        {action.label}
      </Link>
    </div>
  );
}
