import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { daysUntilDeparture } from '@/lib/account-stats';
import { type BookingViewTone, bookingView } from '@/lib/booking-vm';
import { formatDateRange, formatMoney } from '@/lib/tours';

/**
 * `TripCard` — thẻ chuyến đi hướng A (Task 6), thay `BookingCard` cũ.
 *
 * Hai vóc dáng cho hai việc khác nhau, KHÔNG một khuôn dùng chung:
 * - `hero`: nhóm "on the road"/"upcoming" — thứ khách CẦN THẤY NGAY (còn mấy
 *   ngày, có gì phải làm), nên to, có ảnh, có hành động rõ ràng.
 * - `row`: nhóm "past" — chuyến đã xong, chỉ còn giá trị TRA CỨU, nên gọn,
 *   ảnh mờ đi (`opacity-75`), không chiếm nhiều chỗ hơn một dòng danh sách.
 */
export function TripCard({
  booking,
  variant,
}: {
  booking: Booking;
  variant: 'hero' | 'row';
}): ReactNode {
  return variant === 'hero' ? <HeroCard booking={booking} /> : <RowCard booking={booking} />;
}

function HeroCard({ booking }: { booking: Booking }): ReactNode {
  const t = messages.accountBookings;

  // "On the road" suy ra từ chính booking, không phải prop rời: chuyến đã
  // khởi hành (daysToStart <= 0) mà còn ở đây (chưa rơi vào nhóm "past" —
  // `groupBookingsByTime` giữ nó lại vì `departureEndDate` chưa qua) nghĩa
  // là đang diễn ra NGAY BÂY GIỜ. Cùng luật với `groupBookingsByTime`
  // (`account-stats.ts`), không bịa luật thứ hai: đòi CẢ `status === 'PAID'`
  // LẪN `daysToStart <= 0`, không chỉ ngày. Booking `PENDING` chưa giữ chỗ
  // (bất biến #1) nên dù ngày đã tới cũng không phải "đang đi" — vẫn đếm
  // ngược/"Departing today" như một chuyến chưa bắt đầu.
  const daysToStart = daysUntilDeparture(booking.departureStartDate);
  const onTheRoad = booking.status === 'PAID' && daysToStart <= 0;
  const eyebrow = onTheRoad
    ? t.endsOn(formatDateRange(booking.departureEndDate, booking.departureEndDate))
    : t.inDays(daysToStart);

  return (
    <article className="grid gap-4 sm:grid-cols-[240px_1fr]">
      {booking.tourImage ? (
        // `<img>` thường, KHÔNG `next/image`: `next.config.ts` chưa khai
        // `images.remotePatterns` cho host media thật — xem tiền lệ
        // `checkout-summary.tsx`. Đổi sang `next/image` khi hạ tầng ảnh được
        // cấu hình (ngoài phạm vi Task 6).
        // biome-ignore lint/performance/noImgElement: lý do ở comment trên.
        <img
          src={booking.tourImage.url}
          alt={booking.tourImage.alt ?? ''}
          className="aspect-video w-full rounded-xl object-cover sm:aspect-auto sm:h-full sm:min-h-40"
        />
      ) : (
        // Không có ảnh → khối giữ chỗ cùng kích thước, không để layout co lại
        // rồi mọi thẻ trong nhóm cao thấp lệch nhau.
        <div
          className="aspect-video w-full rounded-xl bg-muted sm:aspect-auto sm:h-full sm:min-h-40"
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-primary-emphasis text-xs font-semibold uppercase tracking-wide">
          {eyebrow}
        </p>
        <h3 className="font-heading text-xl text-foreground">{booking.tourTitle}</h3>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
          {' · '}
          {t.travellers(booking.numAdults, booking.numChildren)}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          <span className="font-mono text-xs">{booking.code}</span>
          {' · '}
          {formatMoney(booking.totalAmount, booking.currency)}
        </p>

        <div className="mt-2 flex gap-4 border-t pt-3 text-sm">
          <Link
            href={`/account/bookings/${booking.code}`}
            className="text-foreground underline decoration-1 underline-offset-4 hover:text-primary-emphasis"
          >
            {t.viewBooking}
          </Link>
          <Link
            href="/contact"
            className="text-muted-foreground underline decoration-1 underline-offset-4 hover:text-foreground"
          >
            {t.contactUs}
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Ghi chú cột phải của dòng "past" — tra qua TONE, không if/else theo status
 * rải trong JSX (cùng nguyên tắc `BookingActions`/`bookingView`, xem JSDoc
 * `booking-vm.ts`). Chỉ `muted` (CANCELLED) và `destructive`
 * (REFUNDED/PARTIALLY_REFUNDED) có mặt: đó là hai tone có gì đó để NÓI. `warning`
 * (PENDING quá hạn — chưa trả tiền dù ngày đã qua, ca hiếm nhưng có thật) cố ý
 * vắng mặt — không map vào đây.
 */
const PAST_NOTE: Partial<Record<BookingViewTone, string>> = {
  muted: messages.accountBookings.cancelledNote,
  destructive: messages.accountBookings.refundedNote,
};

function RowCard({ booking }: { booking: Booking }): ReactNode {
  const t = messages.accountBookings;
  const view = bookingView(booking);
  const note = PAST_NOTE[view.tone];

  return (
    <li className="flex items-center gap-4 py-4">
      {booking.tourImage ? (
        // biome-ignore lint/performance/noImgElement: lý do ở `HeroCard` trên.
        <img
          src={booking.tourImage.url}
          alt={booking.tourImage.alt ?? ''}
          className="size-14 shrink-0 rounded-lg object-cover opacity-75"
        />
      ) : (
        <div className="size-14 shrink-0 rounded-lg bg-muted opacity-75" aria-hidden="true" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{booking.tourTitle}</p>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
        </p>
      </div>

      <div className="shrink-0 text-sm">
        {
          view.tone === 'success' ? (
            // Chỉ PAID-đã-qua mới có gì để review — đây là điều kiện tường
            // minh, KHÔNG phải nhánh else mặc định (cùng gốc lỗi review vòng 1:
            // default từng bắt cả PENDING quá hạn, chưa hề trả tiền, đi kèm
            // link "Leave a review" sai sự thật).
            <Link
              href={`/account/bookings/${booking.code}#review`}
              className="text-primary-emphasis underline decoration-1 underline-offset-4 hover:no-underline"
            >
              {t.leaveReview}
            </Link>
          ) : note ? (
            <span className="text-muted-foreground">{note}</span>
          ) : null // tone `warning` (PENDING quá hạn): không note, không link.
        }
      </div>
    </li>
  );
}
