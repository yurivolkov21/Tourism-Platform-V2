import {
  type BookingDetail,
  type BookingPhase,
  bookingPhase,
  tripDayNumbers,
  vietnamToday,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  bookingTotalLabel,
  cancellationDeadlineText,
  operatorRefundPending,
  refundSentence,
  refundSummary,
} from '@/lib/booking-vm';
import { formatBookingMoney } from '@/lib/checkout';
import { type BookingTourData, tourMeetingPoint } from '@/lib/get-ready';
import { parseItineraryStops } from '@/lib/tour-detail';
import { formatMoneyExact, formatWeekdayDate } from '@/lib/tours';
import type { VoucherView } from '@/lib/voucher';
import {
  capList,
  type PrintColumn,
  type PrintList,
  type PrintPhoto,
  type PrintTicketView,
  printPhoto,
  referenceColumn,
  stampTone,
  textColumn,
  ticketCells,
  ticketDate,
} from './print-ticket';

/** Một mục của lịch trình in — cùng hình kết quả `parseItineraryStops`. */
export interface PrintStop {
  time: string | null;
  text: string;
}

/**
 * Voucher in — phương án 5b (G40, spec §3). MỘT nguồn với voucher màn hình (`VoucherView`) cho mộc,
 * mã vạch, dải hết hiệu lực, ngày trả, cổng thanh toán; thêm lịch trình, mục gồm và dải cuối theo giai
 * đoạn. Mọi luật cắt (spec §3.4) nằm ở đây để tờ giấy luôn vừa một trang A4.
 */
export interface VoucherPrintView {
  photo: PrintPhoto | null;
  issued: string;
  kicker: string;
  title: string;
  /** Tên dài hơn `LONG_TITLE_CHARS`: bìa in cỡ nhỏ để vẫn vừa hai dòng. */
  longTitle: boolean;
  ticket: PrintTicketView;
  tear: string | null;
  day: { heading: string; stops: PrintStop[]; more: string | null } | null;
  included: PrintList | null;
  excluded: PrintList | null;
  band: PrintColumn[];
}

/** Một ngày: tối đa 10 mục (spec §3.4). */
export const MAX_STOPS = 10;
/** Nhiều ngày: tối đa 8 dòng — hai cột × bốn (spec §3.4). */
export const MAX_DAY_LINES = 8;
/** Ngưỡng ký tự của tên tour cỡ 27 pt trên hai dòng (quyết định 13 của plan). */
export const LONG_TITLE_CHARS = 56;

export function voucherPrintView(
  booking: BookingDetail,
  view: VoucherView,
  tour: BookingTourData | null,
  now: Date,
): VoucherPrintView {
  const t = messages.printDoc.voucher;
  const today = vietnamToday(now);
  const phase = bookingPhase(booking, today);
  // Chỉ hai giai đoạn này có ô Meeting point, nên trang chỉ đọc tour ở đó (`voucherTourData`);
  // chặn lại ở đây để tour truyền nhầm cũng không làm voucher đã đi, đã huỷ in lịch trình.
  const live = phase === 'upcoming' || phase === 'on_tour';
  const liveTour = live ? tour : null;
  const days = messages.bookingDetail.ticket.days(view.tripDays);
  const firstDay = liveTour?.itinerary.find((day) => day.dayNumber === 1) ?? null;
  const meetTime =
    firstDay === null ? null : (parseItineraryStops(firstDay.description)[0]?.time ?? null);
  const dayOfTrip = phase === 'on_tour' ? tripDayNumbers(booking, today).dayOfTrip : null;

  return {
    photo: printPhoto(booking.tourImage),
    issued: t.issued(view.paidOn),
    kicker: messages.printDoc.kicker(
      view.place,
      days,
      formatWeekdayDate(booking.departureStartDate, { year: true }),
    ),
    title: booking.tourTitle,
    longTitle: booking.tourTitle.length > LONG_TITLE_CHARS,
    ticket: {
      tone: view.cancelledNotice === null ? 'active' : 'closed',
      bandStart: messages.passportVisa.kicker,
      bandEnd: booking.code,
      title: booking.tourTitle,
      stamp: { label: view.stamp.label, tone: stampTone(view.stamp.tone) },
      departs: ticketDate(booking.departureStartDate, meetTime === null ? null : t.meet(meetTime)),
      returns: ticketDate(booking.departureEndDate),
      routeLine: messages.printDoc.routeLine(days, view.place),
      cells: ticketCells(booking, {
        label: messages.bookingDetail.ticket.paidWith,
        value: view.provider,
      }),
      stub: {
        band: messages.bookingDetail.ticket.admit(booking.numAdults + booking.numChildren),
        tag: null,
        amountLabel: bookingTotalLabel(booking),
        amount: formatBookingMoney(booking, booking.totalAmount),
        note: messages.bookingDetail.ticket.taxesIncluded,
        barcode: view.showBarcode ? booking.code : null,
        footer: null,
      },
      notice: view.cancelledNotice,
    },
    tear: view.showBarcode ? t.tear : null,
    day: daySection(booking, view, liveTour, dayOfTrip),
    included: liveTour === null ? null : capList(liveTour.included, t.moreItems),
    excluded: liveTour === null ? null : capList(liveTour.excluded, t.moreItems),
    band: bandColumns(booking, view, phase, liveTour, meetTime),
  };
}

/** Lịch trình in (spec §3.4): ngày đang đi, ngày 1 của chuyến một ngày, hay danh sách ngày. */
function daySection(
  booking: BookingDetail,
  view: VoucherView,
  tour: BookingTourData | null,
  dayOfTrip: number | null,
): VoucherPrintView['day'] {
  const t = messages.printDoc.voucher;
  if (tour === null || tour.itinerary.length === 0) return null;

  if (dayOfTrip !== null || view.tripDays === 1) {
    const day = tour.itinerary.find((d) => d.dayNumber === (dayOfTrip ?? 1));
    if (!day) return null;
    const stops = parseItineraryStops(day.description);
    return stops.length <= MAX_STOPS
      ? { heading: t.yourDay(day.title), stops, more: null }
      : { heading: t.yourDay(day.title), stops: stops.slice(0, MAX_STOPS - 1), more: '…' };
  }

  const heading = t.yourTrip(messages.bookingDetail.ticket.days(view.tripDays));
  const lines: PrintStop[] = [...tour.itinerary]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => ({ time: null, text: t.dayLine(d.dayNumber, d.title) }));
  if (lines.length <= MAX_DAY_LINES) return { heading, stops: lines, more: null };
  const keep = MAX_DAY_LINES - 1;
  return {
    heading,
    stops: lines.slice(0, keep),
    more: t.moreDays(lines.length - keep, booking.tourSlug),
  };
}

/** Dải cuối theo giai đoạn (spec §3.3); cột không có dữ liệu thì bỏ (quyết định 17 của plan). */
function bandColumns(
  booking: BookingDetail,
  view: VoucherView,
  phase: BookingPhase,
  tour: BookingTourData | null,
  meetTime: string | null,
): PrintColumn[] {
  const t = messages.printDoc.voucher;
  const payment = textColumn(
    messages.booking.success.paymentLabel,
    `${t.paymentLine(formatMoneyExact(booking.totalAmount, booking.currency), view.provider, view.paidOn)} ${messages.tourDetail.booking.testMode}`,
  );

  if (phase === 'upcoming' || phase === 'on_tour') {
    const point = tourMeetingPoint(tour);
    const meet: PrintColumn =
      point === null
        ? textColumn(
            t.whereToMeet,
            `${messages.voucher.meetingPointContact} ${messages.voucher.meetingPointFallback}`,
          )
        : {
            heading: t.whereToMeet,
            strong: point,
            text: meetTime === null ? null : t.meetGuide(meetTime),
            reference: false,
          };
    const deadline = cancellationDeadlineText(booking.cancellation);
    return deadline === null
      ? [meet, payment]
      : [meet, textColumn(messages.bookingDetail.details.cancellation, deadline), payment];
  }

  if (phase === 'cancelled') {
    // Cùng chuyện tiền với mốc Refund của nhật ký voucher (`refundJournal` ở `lib/voucher.ts`).
    const summary = refundSummary(booking);
    const refund = operatorRefundPending(booking)
      ? messages.bookingDetail.closed.refundOnItsWay
      : summary === null
        ? null
        : refundSentence(summary, booking.currency);
    return refund === null
      ? [payment]
      : [textColumn(messages.voucher.journal.refund, refund), payment];
  }

  // Đã đi. (`awaiting_payment`, `lapsed` không tới đây: `voucherView` trả null cho đơn chưa trả.)
  return [payment, referenceColumn(booking.code, null)];
}
