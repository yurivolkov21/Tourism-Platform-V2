import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { BookingActions } from '@/components/account/booking-actions';
import type { BookingView } from '@/lib/booking-vm';
import { formatBookingMoney } from '@/lib/checkout';

/**
 * Cột phải của đơn chờ trả (spec P7 §2.5): số tiền phải trả và các nút SẴN CÓ của
 * `BookingActions` (Pay now, huỷ giữ chỗ — hộp xác nhận, lỗi, toast giữ nguyên). Hàng nút đáy
 * của cột trái không lặp nút trả tiền (spec §5.3).
 */
export function AwaitingPaymentPanel({
  booking,
  view,
}: {
  booking: BookingDetail;
  view: BookingView;
}) {
  const t = messages.bookingDetail;
  return (
    <section
      aria-labelledby="awaiting-payment-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5 sm:px-[26px]"
    >
      <h2
        id="awaiting-payment-heading"
        className="text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase"
      >
        {t.journey.awaitingPayment}
      </h2>
      <p className="mt-1.5 font-mono text-[28px] leading-[1.1] font-semibold tabular-nums">
        {formatBookingMoney(booking, booking.totalAmount)}
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        {`${messages.checkoutSummary.totalLabel} · ${t.ticket.taxesIncluded}`}
      </p>
      <p className="mt-3 text-sm">{messages.booking.success.stubNotYetVoucher}</p>
      <div className="mt-4">
        <BookingActions view={view} code={booking.code} />
      </div>
    </section>
  );
}
