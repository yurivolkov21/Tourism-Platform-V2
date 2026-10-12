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
  /**
   * Mục lịch trình và mục gồm kẹp MỘT dòng thay vì hai: chỉ khi ước lượng cho thấy bìa thấp nhất
   * (bìa co giãn trong CSS) vẫn không đủ chỗ (`flexHeightMm` vượt `flexBudgetMm`).
   */
  oneLine: boolean;
}

/** Một ngày: tối đa 10 mục (spec §3.4). */
const MAX_STOPS = 10;
/** Nhiều ngày: tối đa 8 dòng — hai cột × bốn (spec §3.4). */
const MAX_DAY_LINES = 8;
/** Included / Not included: tối đa 6 dòng mỗi cột (spec §3.4). */
const MAX_LIST_ITEMS = 6;
/** Ngưỡng ký tự của tên tour cỡ 27 pt trên hai dòng (quyết định 13 của plan). */
const LONG_TITLE_CHARS = 56;

/**
 * Số đo cho luật "vừa một trang" (spec §3.4, sửa sau thử tay production 12/10: dữ liệu tour thật dài
 * hơn tờ tới 6,5 mm ở 12/59 biến thể của 29 tour seed). Phần co giãn là lịch trình và hai danh sách;
 * các khối khác cao cố định, trừ bìa (co giãn trong CSS từ 62 xuống 52 mm) và dải cuối (theo số
 * dòng). Số ký tự mỗi dòng lấy từ số đo Edge headless của mọi mục trong 29 tour seed (Archivo 9.5 pt):
 * mục ngắn hơn ngưỡng chưa từng gãy dòng; mục dài hơn có lúc vẫn một dòng — ước lượng rơi về phía dư.
 * Đối chiếu 59 biến thể: không ca nào ước lượng thấp hơn thật.
 */
const FIT = {
  /** Một dòng chữ thân: 9.5 pt × 1.45. */
  lineMm: 4.86,
  /** Tiêu đề khối lịch trình cùng khoảng dưới nó. */
  dayHeadMm: 8.1,
  /** Đệm trên dưới của mỗi hàng lịch trình. */
  rowPadMm: 1.6,
  /** Dòng "…" hay "+n more days" dưới lịch trình. */
  dayMoreMm: 5.2,
  /** Tiêu đề Included / Not included cùng khoảng dưới nó. */
  listHeadMm: 7.4,
  /** Khoảng trên mỗi mục gồm. */
  itemGapMm: 0.7,
  /**
   * Ký tự mỗi dòng: chữ lịch trình có cột giờ (68 mm — mục gãy dòng ngắn nhất đo được 45 ký tự),
   * không cột giờ (81,5 mm — mục một dòng dài nhất 52), mục gồm (81,5 mm — mục gãy ngắn nhất 53).
   */
  perLineTimed: 44,
  perLineUntimed: 52,
  perLineList: 52,
  /** Ký tự mỗi dòng của dải cuối: cột đầu rộng (57,7 mm), hai cột sau (50,2 mm). */
  perLineBandWide: 36,
  perLineBand: 28,
  /** Dải cuối thường ba dòng (câu hạn huỷ, câu thanh toán); cột điểm hẹn kẹp bốn. */
  bandLines: 3,
  bandMaxLines: 4,
  /** Chỗ cho lịch trình và hai danh sách khi bìa thấp nhất (52 mm) và dải cuối ba dòng. */
  budgetMm: 97.7,
} as const;

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
  const day = daySection(booking, view, liveTour, dayOfTrip);
  const included = listOf(liveTour?.included);
  const excluded = listOf(liveTour?.excluded);
  const band = bandColumns(booking, view, liveTour, bandMeetTime);

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
    day,
    included,
    excluded,
    band,
    oneLine: flexHeightMm(day, included, excluded, 2) > flexBudgetMm(bandLinesOf(band)),
  };
}

/**
 * Chiều cao ước lượng (mm) của phần co giãn — khối lịch trình và khối hai danh sách — khi mỗi mục
 * kẹp `maxLines` dòng. Lưới lịch trình đổ theo cột nên hàng r ghép mục r với mục r + số hàng, cao
 * theo mục dài hơn; khối danh sách cao theo cột dài hơn.
 */
export function flexHeightMm(
  day: VoucherPrintView['day'],
  included: PrintList | null,
  excluded: PrintList | null,
  maxLines: 1 | 2,
): number {
  let height = 0;
  if (day !== null) {
    const timed = day.stops.some((stop) => stop.time !== null);
    const perLine = timed ? FIT.perLineTimed : FIT.perLineUntimed;
    const rows = Math.ceil(day.stops.length / 2);
    height += FIT.dayHeadMm + (day.more === null ? 0 : FIT.dayMoreMm);
    for (let row = 0; row < rows; row++) {
      const lines = Math.max(
        linesOf(day.stops[row]?.text, perLine, maxLines),
        linesOf(day.stops[row + rows]?.text, perLine, maxLines),
      );
      height += lines * FIT.lineMm + FIT.rowPadMm;
    }
  }
  if (included !== null || excluded !== null) {
    height += FIT.listHeadMm + Math.max(columnMm(included, maxLines), columnMm(excluded, maxLines));
  }
  return height;
}

/** Chỗ (mm) cho phần co giãn khi bìa thấp nhất; dải cuối cao hơn ba dòng thì bớt đi. */
export function flexBudgetMm(bandLines: number): number {
  return FIT.budgetMm - Math.max(0, bandLines - FIT.bandLines) * FIT.lineMm;
}

/** Số dòng ước lượng của một đoạn chữ, ít nhất một, kẹp `max`; không có chữ thì 0. */
function linesOf(text: string | undefined, perLine: number, max: number): number {
  if (text === undefined) return 0;
  return Math.min(max, Math.max(1, Math.ceil(text.length / perLine)));
}

function columnMm(list: PrintList | null, maxLines: number): number {
  if (list === null) return 0;
  const items = list.items.reduce(
    (sum, item) => sum + linesOf(item, FIT.perLineList, maxLines) * FIT.lineMm + FIT.itemGapMm,
    0,
  );
  return items + (list.more === null ? 0 : FIT.lineMm + FIT.itemGapMm);
}

/**
 * Số dòng ước lượng của dải cuối: cột dài nhất, ít nhất ba (câu hạn huỷ và câu thanh toán luôn ba
 * dòng); cột có phần đậm (điểm hẹn) kẹp bốn dòng như `PrintBand`.
 */
function bandLinesOf(band: PrintColumn[]): number {
  return band.reduce<number>((most, column, index) => {
    const text = typeof column.text === 'string' ? column.text : '';
    const chars = (column.strong?.length ?? 0) + text.length + (column.strong && text ? 3 : 0);
    const perLine = index === 0 ? FIT.perLineBandWide : FIT.perLineBand;
    const lines = Math.ceil(chars / perLine);
    return Math.max(most, column.strong ? Math.min(FIT.bandMaxLines, lines) : lines);
  }, FIT.bandLines);
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
