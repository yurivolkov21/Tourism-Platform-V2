import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  type BookingView,
  legacyCancellationNote,
  type RefundSummary,
  refundSummary,
} from '@/lib/booking-vm';
import { formatMoneyExact } from '@/lib/tours';

/**
 * Cột phải của đơn đã kết thúc mà không đi (spec P7 §2.5): đã huỷ hay đã hoàn đủ
 * (`cancelled` — câu kết thúc của `bookingView`, chữ hoàn tiền của `refundSummary`) và giữ chỗ
 * không trả kịp (`lapsed`). Cả hai mở lối "Browse tours".
 */
export function TripClosedPanel({
  booking,
  view,
  kind,
}: {
  booking: BookingDetail;
  view: BookingView;
  kind: 'cancelled' | 'lapsed';
}) {
  const t = messages.bookingDetail;
  if (kind === 'lapsed') {
    return (
      <ClosedFrame title={t.journey.paymentNotCompleted}>
        <p className="mt-2 text-[15px] font-semibold">{t.closed.notPaidInTime}</p>
      </ClosedFrame>
    );
  }
  const terminalNote = messages.accountBookingDetail.terminalNote[view.statusKey];
  const legacyNote = legacyCancellationNote(booking);
  const refund = refundSummary(booking);
  return (
    <ClosedFrame title={t.journey.cancelled}>
      {terminalNote ? <p className="mt-2 text-[15px] font-semibold">{terminalNote}</p> : null}
      {legacyNote ? <p className="mt-1 text-sm text-muted-foreground">{legacyNote}</p> : null}
      {refund ? <RefundText refund={refund} currency={booking.currency} /> : null}
    </ClosedFrame>
  );
}

function ClosedFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby="trip-closed-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5 sm:px-[26px]"
    >
      <h2
        id="trip-closed-heading"
        className="text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
      <ButtonLink href="/tours" variant="outline" className="mt-4">
        {messages.booking.list.browse}
      </ButtonLink>
    </section>
  );
}

/**
 * Chữ hoàn tiền — dời từ `RefundLine` của trang cũ, giữ nguyên luật: `formatMoneyExact` vì đây
 * là số tiền THẬT khách đối chiếu với sao kê; không hoàn đồng nào thì câu tiếp theo là chỗ tra
 * lý do (link chính sách), không phải lời hứa về thời gian chờ.
 */
function RefundText({ refund, currency }: { refund: RefundSummary; currency: string }) {
  const t = messages.accountBookingDetail.refundLine;
  const sentence =
    refund.kind === 'full'
      ? t.full(formatMoneyExact(refund.amount, currency))
      : refund.kind === 'partial'
        ? t.partial(
            formatMoneyExact(refund.amount, currency),
            formatMoneyExact(refund.total, currency),
          )
        : t.none;
  return (
    <div className="mt-3 text-[13.5px]">
      <p>{sentence}</p>
      <p className="mt-0.5 text-muted-foreground">
        {refund.kind === 'none' ? (
          <Link href="/cancellation-policy" className="underline-offset-4 hover:underline">
            {messages.cancellationDeadline.policyLink}
          </Link>
        ) : (
          t.timing
        )}
      </p>
    </div>
  );
}
