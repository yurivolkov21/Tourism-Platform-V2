import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { TONE_CLASS } from '@/components/account/account-dashboard';
import { bookingView } from '@/lib/booking-vm';
import { formatDateRange, formatMoney } from '@/lib/tours';

/**
 * Một dòng trong `/account/bookings` (spec §3) — badge tone lấy NGUYÊN
 * `TONE_CLASS`/`bookingView` (Task 2, export lại từ `account-dashboard.tsx`
 * theo đúng lời dặn brief Task 4: một nguồn map tone→class, không tự chế bản
 * thứ hai). Cả card là một `Link` tới trang detail — "View details" chỉ là
 * gợi ý thị giác cuối card, không phải hành động riêng.
 */
export function BookingCard({ booking }: { booking: Booking }) {
  const t = messages.accountBookings;
  const view = bookingView(booking);

  return (
    <li>
      <Link
        href={`/account/bookings/${booking.code}`}
        className="group flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[view.tone]}`}
            >
              {messages.booking.list.status[booking.status]}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{booking.code}</span>
          </div>
          <p className="mt-2 truncate font-heading text-lg font-medium text-foreground">
            {booking.tourTitle}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateRange(booking.departureStartDate, booking.departureEndDate)} ·{' '}
            {t.travellers(booking.numAdults, booking.numChildren)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-6 sm:flex-col sm:items-end sm:gap-1">
          <p className="font-heading text-lg font-semibold tabular-nums text-foreground">
            {formatMoney(booking.totalAmount, booking.currency)}
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-primary group-hover:underline">
            {t.viewDetails}
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </li>
  );
}
