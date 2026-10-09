import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PanelCard, PanelKicker } from '@/components/account/panel-card';
import {
  type BookingView,
  cancelledByOperator,
  legacyCancellationNote,
  operatorRefundPending,
  type RefundSummary,
  refundSentence,
  refundSummary,
} from '@/lib/booking-vm';

/**
 * Cột phải của đơn đã kết thúc mà không đi (spec P7 §2.5): đã huỷ hay đã hoàn đủ
 * (`cancelled` — câu kết thúc của `bookingView`, chữ hoàn tiền của `refundSummary`) và giữ chỗ
 * qua hạn chót mà chưa trả (`lapsed`). Cả hai mở lối "Browse tours".
 *
 * `lapsed` nói có điều kiện, không khẳng định "đã lỡ": claim của API vẫn nhận phiên thanh toán mở
 * TRƯỚC hạn (Stripe tới 60 phút, PayPal tới 3 giờ), trả xong đơn tự sang PAID (ADR-0054 AMEND 1
 * §4). Câu cũ "wasn't paid in time" dễ khiến khách bỏ một tab thanh toán còn trả được (review P7 S1).
 *
 * Chuyến bị CÔNG TY huỷ (`cancelledByOperator`, ADR-0041 AMEND 1) có câu riêng: "chúng tôi huỷ
 * chuyến", rồi chuyện tiền — đang về khi job hoàn tiền chưa chạy (đơn còn PAID), số đã hoàn khi
 * job xong. Trước AMEND 1 đơn ấy hiện như chuyến còn chạy cho tới lúc job chạy.
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
        <p className="mt-2 text-[15px] font-semibold">{t.closed.notPaidByDeadline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.closed.finishOpenPayment}</p>
      </ClosedFrame>
    );
  }
  const refund = refundSummary(booking);
  if (cancelledByOperator(booking)) {
    return (
      <ClosedFrame title={t.closed.departureCancelled}>
        <p className="mt-2 text-[15px] font-semibold">{t.closed.weCancelled}</p>
        {operatorRefundPending(booking) ? (
          <MoneyLines
            sentence={t.closed.refundOnItsWay}
            note={messages.accountBookingDetail.refundLine.timing}
          />
        ) : refund ? (
          <RefundText refund={refund} currency={booking.currency} />
        ) : null}
      </ClosedFrame>
    );
  }
  const terminalNote = messages.accountBookingDetail.terminalNote[view.statusKey];
  const legacyNote = legacyCancellationNote(booking);
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
    <PanelCard aria-labelledby="trip-closed-heading">
      <PanelKicker id="trip-closed-heading">{title}</PanelKicker>
      {children}
      <ButtonLink href="/tours" variant="outline" className="mt-4">
        {messages.booking.list.browse}
      </ButtonLink>
    </PanelCard>
  );
}

/**
 * Chữ hoàn tiền — dời từ `RefundLine` của trang cũ: câu kể khoản hoàn là `refundSentence` dùng
 * chung với voucher; không hoàn đồng nào thì câu tiếp theo là chỗ tra lý do (link chính sách),
 * không phải lời hứa về thời gian chờ.
 */
function RefundText({ refund, currency }: { refund: RefundSummary; currency: string }) {
  return (
    <MoneyLines
      sentence={refundSentence(refund, currency)}
      note={
        refund.kind === 'none' ? (
          <Link href="/cancellation-policy" className="underline-offset-4 hover:underline">
            {messages.cancellationDeadline.policyLink}
          </Link>
        ) : (
          messages.accountBookingDetail.refundLine.timing
        )
      }
    />
  );
}

/** Hai dòng tiền của khối đóng: câu kể chuyện tiền, rồi dòng phụ khách tra tiếp. */
function MoneyLines({ sentence, note }: { sentence: string; note: ReactNode }) {
  return (
    <div className="mt-3 text-[13.5px]">
      <p>{sentence}</p>
      <p className="mt-0.5 text-muted-foreground">{note}</p>
    </div>
  );
}
