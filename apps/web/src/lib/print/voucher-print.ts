import { type BookingDetail, bookingPhase, tripDayNumbers, vietnamToday } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { bookingTotalLabel, cancellationDeadlineText, refundStory } from '@/lib/booking-vm';
import { formatBookingMoney } from '@/lib/checkout';
import { type BookingTourData, tourMeetingPoint, uniqueItems } from '@/lib/get-ready';
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
const MAX_STOPS = 10;
/** Nhiều ngày: tối đa 8 dòng — hai cột × bốn (spec §3.4). */
const MAX_DAY_LINES = 8;
/** Included / Not included: tối đa 6 dòng mỗi cột (spec §3.4). */
const MAX_LIST_ITEMS = 6;
/** Ngưỡng ký tự của tên tour cỡ 27 pt trên hai dòng (quyết định 13 của plan). */
const LONG_TITLE_CHARS = 56;

export function voucherPrintView(
  booking: BookingDetail,
  view: VoucherView,
  tour: BookingTourData | null,
  now: Date,
): VoucherPrintView {
  const t = messages.printDoc.voucher;
  const today = vietnamToday(now);
  const phase = bookingPhase(booking, today);
  // Chỉ voucher có ô Meeting point (sắp đi, đang đi — `showMeetingPoint`, cùng luật đọc tour của
  // trang) mới in lịch trình, mục gồm và điểm hẹn; tour truyền nhầm cũng không lọt vào voucher đã
  // đi, đã huỷ.
  const liveTour = view.showMeetingPoint ? tour : null;
  const days = messages.bookingDetail.ticket.days(view.tripDays);
  const firstDay = liveTour?.itinerary.find((day) => day.dayNumber === 1) ?? null;
  const meetTime =
    firstDay === null ? null : (parseItineraryStops(firstDay.description)[0]?.time ?? null);
  const dayOfTrip = phase === 'on_tour' ? tripDayNumbers(booking, today).dayOfTrip : null;
  // Giờ hẹn là của NGÀY 1: đang đi từ ngày 2 thì dải cuối không nói "meet your guide at 08:00" cạnh
  // lịch hôm nay có giờ khác (review G40). Dòng ngày đi vẫn giữ — nó gắn với ngày đi.
  const bandMeetTime = dayOfTrip === null || dayOfTrip === 1 ? meetTime : null;
  const refunded = Number(booking.refundedTotal) > 0;

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
        // Cùng hình voucher màn hình (`VoucherPass`): có khoản hoàn thì kể "Refunded −$X" và tổng đủ
        // hai số lẻ — tiền hoàn luôn đủ hai số lẻ (đối chiếu sao kê), hai độ chính xác cạnh nhau là lạ.
        amount: formatBookingMoney(booking, booking.totalAmount, { exact: refunded }),
        note: messages.bookingDetail.ticket.taxesIncluded,
        barcode: view.showBarcode ? booking.code : null,
        footer: refunded
          ? {
              label: messages.voucher.refunded,
              value: messages.voucher.refundedAmount(
                formatMoneyExact(booking.refundedTotal, booking.currency),
              ),
            }
          : null,
      },
      notice: view.cancelledNotice,
    },
    tear: view.showBarcode ? t.tear : null,
    day: daySection(booking, view, liveTour, dayOfTrip),
    included: listOf(liveTour?.included),
    excluded: listOf(liveTour?.excluded),
    band: bandColumns(booking, view, liveTour, bandMeetTime),
  };
}

/** Included / Not included: bỏ mục trống, mục trùng (`uniqueItems`) rồi cắt theo luật chung. */
function listOf(items: string[] | undefined): PrintList | null {
  return items === undefined
    ? null
    : capList(uniqueItems(items), MAX_LIST_ITEMS, messages.printDoc.voucher.moreItems);
}

/**
 * Lịch trình in (spec §3.4): ngày đang đi, ngày 1 của chuyến một ngày, hay danh sách ngày. Ngày cần
 * in không có mô tả thì bỏ cả khối — không in tiêu đề "Your day" trên một danh sách trống.
 */
function daySection(
  booking: BookingDetail,
  view: VoucherView,
  tour: BookingTourData | null,
  dayOfTrip: number | null,
): VoucherPrintView['day'] {
  const t = messages.printDoc.voucher;
  if (tour === null) return null;

  if (dayOfTrip !== null || view.tripDays === 1) {
    const day = tour.itinerary.find((d) => d.dayNumber === (dayOfTrip ?? 1));
    if (!day) return null;
    const stops = capList(parseItineraryStops(day.description), MAX_STOPS, () => '…');
    return stops === null ? null : { heading: t.yourDay(day.title), ...stopsOf(stops) };
  }

  const lines = capList(
    [...tour.itinerary]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((d) => ({
        time: null,
        text: `${messages.tourDetail.itinerary.dayLabel(d.dayNumber)} · ${d.title}`,
      })),
    MAX_DAY_LINES,
    (n) => t.moreDays(n, booking.tourSlug),
  );
  return lines === null
    ? null
    : { heading: t.yourTrip(messages.bookingDetail.ticket.days(view.tripDays)), ...stopsOf(lines) };
}

function stopsOf(list: PrintList<PrintStop>): { stops: PrintStop[]; more: string | null } {
  return { stops: list.items, more: list.more };
}

/** Dải cuối theo giai đoạn (spec §3.3); cột không có dữ liệu thì bỏ (quyết định 17 của plan). */
function bandColumns(
  booking: BookingDetail,
  view: VoucherView,
  tour: BookingTourData | null,
  meetTime: string | null,
): PrintColumn[] {
  const t = messages.printDoc.voucher;
  const payment = textColumn(
    messages.booking.success.paymentLabel,
    `${t.paymentLine(formatMoneyExact(booking.totalAmount, booking.currency), view.provider, view.paidOn)} ${messages.tourDetail.booking.testMode}`,
  );

  if (view.showMeetingPoint) {
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

  if (view.cancelledNotice !== null) {
    // Cùng chuyện tiền với mốc Refund của nhật ký voucher (`refundStory`, một thứ tự cho mọi nơi kể).
    const refund = refundStory(booking);
    return refund === null
      ? [payment]
      : [textColumn(messages.voucher.journal.refund, refund), payment];
  }

  // Đã đi. (`awaiting_payment`, `lapsed` không tới đây: `voucherView` trả null cho đơn chưa trả.)
  return [payment, referenceColumn(booking.code, null)];
}
