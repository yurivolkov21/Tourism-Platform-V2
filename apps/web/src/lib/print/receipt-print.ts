import {
  type Booking,
  type BookingPhase,
  bookingPhase,
  tripLengthDays,
  VIETNAM_TIME_ZONE,
  vietnamToday,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  formatPrintDate,
  formatPrintDateTime,
  formatPrintDayMonth,
  formatPrintTime,
} from '@tourism/ui/lib/print-time';
import {
  bookingTotalLabel,
  paymentProviderLabel,
  refundSentence,
  refundSummary,
} from '@/lib/booking-vm';
import { formatBookingMoney, pendingDeadline } from '@/lib/checkout';
import { formatWeekdayDate } from '@/lib/tours';
import {
  type PrintColumn,
  type PrintPhoto,
  type PrintTicketView,
  printPhoto,
  referenceColumn,
  textColumn,
  ticketCells,
  ticketDate,
} from './print-ticket';

/**
 * Hoá đơn chờ in — B1 (G40, spec §4): cùng hình tấm vé của voucher 5b ở trạng thái chờ. Đơn chưa
 * trả không giữ ghế (invariant #1 của API): chữ nói giờ nhả cụ thể, không đếm ngược, không hứa giữ
 * chỗ. Đơn đã đóng (G37) không hứa mã sẽ thành voucher.
 */
export interface ReceiptPrintView {
  photo: PrintPhoto | null;
  booked: string;
  kicker: string;
  title: string;
  ticket: PrintTicketView;
  tear: string;
  line: {
    item: string;
    sub: string;
    travellers: string;
    price: string;
    priceNote: string;
    amount: string;
  };
  total: { label: string; amount: string; note: string };
  band: PrintColumn[];
}

export function receiptPrintView(booking: Booking, now: Date): ReceiptPrintView {
  const r = messages.printDoc.receipt;
  const zone = VIETNAM_TIME_ZONE;
  const phase = bookingPhase(booking, vietnamToday(now));
  // Quyết định 18 của plan: PENDING quá 65 phút mà cron chưa quét vẫn "đang chờ" — API còn nhận trả,
  // màn hình (`checkoutMood`) cũng chưa khai đã đóng. `lapsed` thì API đã thôi mở phiên trả.
  const closed = booking.status !== 'PENDING' || phase === 'lapsed';
  const deadline = pendingDeadline(booking.createdAt);
  const days = messages.bookingDetail.ticket.days(
    tripLengthDays(booking.departureStartDate, booking.departureEndDate),
  );
  const place = booking.tourDestinations[0]?.name ?? booking.tourTitle;
  const when = formatWeekdayDate(booking.departureStartDate, { year: true });
  const amount = formatBookingMoney(booking, booking.totalAmount);
  const reference = referenceColumn(booking.code, r.bookedBy(booking.contactEmail));

  return {
    photo: printPhoto(booking.tourImage),
    booked: r.booked(formatPrintDateTime(new Date(booking.createdAt), zone)),
    kicker: messages.printDoc.kicker(place, days, when),
    title: booking.tourTitle,
    ticket: {
      tone: closed ? 'closed' : 'pending',
      bandStart: closed ? r.closedBand : r.pendingBand,
      bandEnd: booking.code,
      title: booking.tourTitle,
      stamp: closed
        ? { label: r.stampClosed, tone: 'muted' }
        : { label: r.stampPending, tone: 'pending' },
      departs: ticketDate(booking.departureStartDate),
      returns: ticketDate(booking.departureEndDate),
      routeLine: messages.printDoc.routeLine(days, place),
      cells: ticketCells(booking, {
        label: messages.booking.success.paymentLabel,
        value: paymentProviderLabel(booking.paymentProvider),
      }),
      stub: {
        band: r.unpaid,
        tag: closed ? null : r.notYetVoucher,
        amountLabel: null,
        amount,
        note: r.totalNote,
        barcode: null,
        footer: closed
          ? { label: r.noPayment, value: null }
          : {
              label: r.payBy,
              value: `${formatPrintTime(deadline, zone)} · ${formatPrintDayMonth(deadline, zone)}`,
            },
      },
      notice: null,
    },
    tear: closed ? messages.booking.success.stubClosed : messages.booking.success.stubNotYetVoucher,
    line: {
      item: booking.tourTitle,
      sub: `${when} · ${days} · ${place}`,
      travellers: messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
      price: formatBookingMoney(booking, booking.unitPrice),
      priceNote: messages.booking.success.perTraveller,
      amount,
    },
    total: { label: bookingTotalLabel(booking), amount, note: messages.checkoutSummary.taxesNote },
    band: closed
      ? [
          textColumn(r.whatHappened, closedReason(booking, phase)),
          textColumn(r.bookAgain, r.bookAgainBody(booking.tourSlug)),
          reference,
        ]
      : [
          textColumn(r.howToPay, `${r.howToPayBody} ${messages.tourDetail.booking.testMode}`),
          textColumn(
            r.ifUnpaid,
            r.releasedAt(`${formatPrintTime(deadline, zone)}, ${formatPrintDate(deadline, zone)}`),
          ),
          reference,
        ],
  };
}

/**
 * "What happened" của đơn chưa trả đã đóng (spec §4.3): câu lapsed hay câu kết cục sẵn có của trang
 * chi tiết đơn; bị thu rồi hoàn tự động (`paidAt` null mà sổ có khoản hoàn) thì kể thêm khoản hoàn.
 */
function closedReason(booking: Booking, phase: BookingPhase): string {
  const base =
    phase === 'lapsed'
      ? messages.bookingDetail.closed.notPaidByDeadline
      : (messages.accountBookingDetail.terminalNote[booking.status] ??
        messages.booking.success.settledBody);
  const refund = refundSummary(booking);
  return refund === null ? base : `${base} ${refundSentence(refund, booking.currency)}`;
}
