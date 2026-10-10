import {
  type Booking,
  bookingPhase,
  tripLengthDays,
  VIETNAM_TIME_ZONE,
  vietnamToday,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatPrintDateTime, formatPrintTime } from '@tourism/ui/lib/print-time';
import {
  bookingTotalLabel,
  closedNarrative,
  paymentProviderLabel,
  refundStory,
  wasCharged,
} from '@/lib/booking-vm';
import { closedStubSentence, formatBookingMoney, pendingDeadline } from '@/lib/checkout';
import { formatChipDate, formatDate, formatWeekdayDate } from '@/lib/tours';
import { tripPlace } from '@/lib/voucher';
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
  /** Dòng xé; `null` với đơn quá hạn chót — giấy không hứa, cũng không khẳng định gì ở đó. */
  tear: string | null;
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

/**
 * Ba trạng thái của hoá đơn in: đang chờ trả · qua hạn chót mà chưa trả (`lapsed` — CHƯA phải kết
 * cục: claim của API còn nhận phiên mở trước hạn, ADR-0054 AMEND 1 §4) · đã đóng (trạng thái khác
 * PENDING). Đơn quá mốc mà cron chưa quét vẫn "đang chờ" — API còn nhận trả, màn hình
 * (`checkoutMood`) cũng chưa khai đã đóng (quyết định 18 của plan).
 */
type ReceiptState = 'pending' | 'lapsed' | 'closed';

export function receiptPrintView(booking: Booking, now: Date): ReceiptPrintView {
  const r = messages.printDoc.receipt;
  const zone = VIETNAM_TIME_ZONE;
  const phase = bookingPhase(booking, vietnamToday(now));
  const state: ReceiptState =
    booking.status !== 'PENDING' ? 'closed' : phase === 'lapsed' ? 'lapsed' : 'pending';
  // Bị thu rồi hoàn tự động (`paidAt` null mà sổ có khoản hoàn): giấy không được nói "chưa trả" hay
  // "không thu tiền" cạnh khoản vừa kể là đã hoàn (`wasCharged`, cùng bất biến review P7 B1).
  const charged = state === 'closed' && wasCharged(booking);
  const deadline = pendingDeadline(booking);
  const deadlineDay = vietnamToday(deadline);
  const deadlineTime = formatPrintTime(deadline, zone);
  const days = messages.bookingDetail.ticket.days(
    tripLengthDays(booking.departureStartDate, booking.departureEndDate),
  );
  const place = tripPlace(booking);
  const when = formatWeekdayDate(booking.departureStartDate, { year: true });
  const amount = formatBookingMoney(booking, booking.totalAmount);
  const reference = referenceColumn(booking.code, r.bookedBy(booking.contactEmail));

  return {
    photo: printPhoto(booking.tourImage),
    booked: r.booked(formatPrintDateTime(new Date(booking.createdAt), zone)),
    kicker: messages.printDoc.kicker(place, days, when),
    title: booking.tourTitle,
    ticket: {
      tone: state === 'pending' ? 'pending' : 'closed',
      bandStart: { pending: r.pendingBand, lapsed: r.lapsedBand, closed: r.closedBand }[state],
      bandEnd: booking.code,
      title: booking.tourTitle,
      stamp: {
        pending: { label: r.stampPending, tone: 'pending' } as const,
        lapsed: { label: messages.passportVisa.stampLapsed, tone: 'muted' } as const,
        closed: { label: r.stampClosed, tone: 'muted' } as const,
      }[state],
      departs: ticketDate(booking.departureStartDate),
      returns: ticketDate(booking.departureEndDate),
      routeLine: messages.printDoc.routeLine(days, place),
      cells: ticketCells(booking, {
        label: messages.booking.success.paymentLabel,
        value: paymentProviderLabel(booking.paymentProvider),
      }),
      stub: {
        band: charged ? (messages.booking.list.status[booking.status] ?? r.unpaid) : r.unpaid,
        tag: state === 'pending' ? r.notYetVoucher : null,
        amountLabel: null,
        amount,
        note: r.totalNote,
        barcode: null,
        // Chờ trả: hạn trả. Qua hạn chót: không hạn nào (API thôi mở phiên mới) và không khẳng
        // định "không thu" (phiên mở trước hạn còn có thể về). Đã đóng mà chưa thu: nói thẳng.
        footer:
          state === 'pending'
            ? { label: r.payBy, value: `${deadlineTime} · ${formatChipDate(deadlineDay)}` }
            : state === 'closed' && !charged
              ? { label: r.noPayment, value: null }
              : null,
      },
      notice: null,
    },
    tear:
      state === 'pending'
        ? messages.booking.success.stubNotYetVoucher
        : state === 'closed'
          ? closedStubSentence(booking)
          : null,
    line: {
      item: booking.tourTitle,
      sub: `${when} · ${days} · ${place}`,
      travellers: messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
      price: formatBookingMoney(booking, booking.unitPrice),
      priceNote: messages.booking.success.perTraveller,
      amount,
    },
    total: { label: bookingTotalLabel(booking), amount, note: messages.checkoutSummary.taxesNote },
    band:
      state === 'pending'
        ? [
            textColumn(r.howToPay, `${r.howToPayBody} ${messages.tourDetail.booking.testMode}`),
            textColumn(r.ifUnpaid, r.releasedAt(`${deadlineTime}, ${formatDate(deadlineDay)}`)),
            reference,
          ]
        : [
            textColumn(r.whatHappened, closedReason(booking, state)),
            textColumn(r.bookAgain, r.bookAgainBody(booking.tourSlug)),
            reference,
          ],
  };
}

/**
 * "What happened" (spec §4.3): câu kể kết cục của trang chi tiết đơn (`closedNarrative` — câu quá
 * hạn có điều kiện, câu chuyến công ty huỷ, câu theo trạng thái) rồi chuyện tiền (`refundStory`) khi
 * đơn đã bị thu rồi hoàn.
 */
function closedReason(booking: Booking, state: 'lapsed' | 'closed'): string {
  const story = closedNarrative(booking, state === 'lapsed' ? 'lapsed' : 'cancelled');
  const money = state === 'lapsed' ? null : refundStory(booking);
  return [story.headline ?? messages.booking.success.settledBody, story.note, money]
    .filter((part): part is string => part !== null)
    .join(' ');
}
