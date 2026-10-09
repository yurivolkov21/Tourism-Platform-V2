import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { BookingActions } from '@/components/account/booking-actions';
import { PanelCard, PanelKicker } from '@/components/account/panel-card';
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
    <PanelCard aria-labelledby="awaiting-payment-heading">
      <PanelKicker id="awaiting-payment-heading">{t.journey.awaitingPayment}</PanelKicker>
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
    </PanelCard>
  );
}
