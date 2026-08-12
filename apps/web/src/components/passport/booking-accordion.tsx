'use client';

import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@tourism/ui/components/accordion';
import { Badge } from '@tourism/ui/components/badge';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { IconTile } from '@tourism/ui/components/reui/icon-tile';
import { PlaneIcon } from 'lucide-react';
import Link from 'next/link';
import { daysUntilDeparture } from '@/lib/account-stats';
import { bookingView } from '@/lib/booking-vm';
import { formatDateRange, formatMoney } from '@/lib/tours';

/**
 * Danh sách booking dạng ACCORDION xổ-inline (vòng 12/08 — user tham khảo
 * pattern "coupon manager" của ReUI, dựng lại bằng đồ nhà, KHÔNG cài block
 * trả phí): mỗi booking một row bo tròn — icon tile + tên tour + badge
 * trạng thái chấm màu + dòng mã mono/đếm ngược/ngày + tổng tiền; bấm xổ ra
 * thẻ chi tiết (lưới nhãn IATA + hàng action theo trạng thái). Row ĐẦU mở
 * sẵn — sort của trang đã đặt chuyến khẩn nhất lên đầu.
 *
 * Mọi phân nhánh đi qua `bookingView` (một nguồn, không if/else status thô)
 * — kế thừa nguyên luật của JourneyRow mà nó thay thế; flow phức tạp (hủy,
 * review) vẫn ở trang chi tiết, ở đây chỉ có thông tin + lối vào.
 *
 * `today` truyền từ server (chuỗi `YYYY-MM-DD`, so lexicographic) — client
 * KHÔNG tự lấy giờ máy để tránh lệch hydration qua nửa đêm.
 */

/** Chấm màu trong badge theo tone — tra bảng, thiếu thì rơi về muted. */
const DOT_CLASS: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  muted: 'bg-muted-foreground/60',
  destructive: 'bg-muted-foreground/60',
};

const BADGE_TONE: Record<string, string> = {
  success: 'border-success/40 text-success',
  warning: 'border-warning/50 text-warning',
  muted: 'text-muted-foreground',
  destructive: 'text-muted-foreground',
};

export function BookingAccordion({ bookings, today }: { bookings: Booking[]; today: string }) {
  const tb = messages.accountBookings;
  const bl = messages.booking.list;
  const tv = messages.passportVisa;
  const first = bookings[0]?.code;
  return (
    <Accordion multiple={false} defaultValue={first ? [first] : []} className="gap-3">
      {bookings.map((booking) => {
        const view = bookingView(booking);
        const started = booking.departureStartDate <= today;
        const ended = booking.departureEndDate < today;
        const detailHref = `/account/bookings/${booking.code}`;
        // Mảnh đầu meta — cùng nguồn đếm ngược/`Ends …` với JourneyRow cũ.
        const lead =
          view.tone === 'success' && started && !ended
            ? tb.endsOn(formatDateRange(booking.departureEndDate, booking.departureEndDate))
            : !started && (view.tone === 'success' || view.tone === 'warning')
              ? tb.inDays(daysUntilDeparture(booking.departureStartDate, today))
              : null;
        const canPay = view.actions.includes('payNow') && !ended;
        const canReview = view.tone === 'success' && ended;

        return (
          <AccordionItem
            key={booking.id}
            value={booking.code}
            className="rounded-2xl border border-border bg-card px-4 not-last:border-b md:px-5"
          >
            <AccordionTrigger className="items-center gap-3 py-3.5 hover:no-underline">
              <IconTile variant="frame" size="default" aria-hidden="true">
                <PlaneIcon />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-heading text-[15px] font-semibold">
                    {booking.tourTitle}
                  </span>
                  <Badge
                    variant="outline"
                    className={`gap-1.5 ${BADGE_TONE[view.tone] ?? BADGE_TONE.muted}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-1.5 rounded-full ${DOT_CLASS[view.tone] ?? DOT_CLASS.muted}`}
                    />
                    {bl.status[booking.status]}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                  <span className="font-mono text-xs">{booking.code}</span>
                  {' · '}
                  {lead ? `${lead} · ` : ''}
                  {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
                </p>
              </div>
              <span className="mr-1 hidden flex-none font-mono text-[13px] font-semibold tabular-nums sm:block">
                {formatMoney(booking.totalAmount, booking.currency)}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 [&_a]:no-underline">
              {/* Thẻ chi tiết trắng lồng trong row — đảo nền như mẫu coupon
                  (row nhạt, ruột đậm tương phản). */}
              <div className="rounded-xl border border-border/70 bg-background p-4 md:p-5">
                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
                  <div>
                    <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                      {tv.labels.dates}
                    </dt>
                    <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums">
                      {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                      {tv.labels.travellers}
                    </dt>
                    <dd className="mt-0.5 text-[14px] font-semibold">
                      {tb.travellers(booking.numAdults, booking.numChildren)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                      {tv.labels.reference}
                    </dt>
                    <dd className="mt-0.5 font-mono text-[14px] font-semibold">{booking.code}</dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                      {tv.labels.total}
                    </dt>
                    <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums">
                      {formatMoney(booking.totalAmount, booking.currency)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-dashed border-border pt-4">
                  {canPay ? (
                    <ButtonLink size="sm" href={detailHref}>
                      {messages.accountBookingDetail.actions.payNow}
                    </ButtonLink>
                  ) : null}
                  <ButtonLink variant="outline" size="sm" href={detailHref}>
                    {bl.viewDetails}
                  </ButtonLink>
                  {view.tone === 'success' ? (
                    <Link
                      href={`/checkout/success?code=${booking.code}`}
                      className="text-[13px] font-semibold text-primary-emphasis hover:underline"
                    >
                      {tv.viewVoucher}
                    </Link>
                  ) : null}
                  {canReview ? (
                    <Link
                      href={`${detailHref}#review`}
                      className="text-[13px] font-semibold text-primary-emphasis hover:underline"
                    >
                      {messages.passportHome.journeyReview}
                    </Link>
                  ) : null}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
