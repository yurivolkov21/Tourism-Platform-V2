import { type BookingDetail, bookingPhase, tripLengthDays, vietnamToday } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  type BookingStamp,
  bookingPass,
  cancelledByOperator,
  cancelledOn,
  freeCancellationOpen,
  operatorRefundPending,
  paymentProviderLabel,
  refundSentence,
  refundSummary,
  vietnamDay,
} from './booking-vm';
import { reviewSlot } from './review';
import { formatChipDate, formatDate, formatDateRange } from './tours';

/**
 * Voucher còn "vừa trả tiền" trong bao nhiêu phút kể từ `paidAt` (spec P7 §2.6).
 *
 * Trong khoảng này trang chào "… is booked." và bắn pháo giấy; quá nó là khách MỞ LẠI voucher
 * (từ email, từ "View voucher") — lúc ấy chúc mừng hay hứa "email đang tới" là nói sai. Đo bằng
 * đồng hồ của server web lúc render, không bằng đồng hồ máy khách.
 */
export const VOUCHER_FRESH_MINUTES = 30;

/** Một mốc của "Trip journal" ở mảng teal. */
export interface VoucherJournalItem {
  label: string;
  /** Dòng nhỏ dưới nhãn (ngày, cổng, số tiền) — `null` khi không có gì đáng in. */
  detail: string | null;
  /** Mốc đã xảy ra: vẽ dấu tích. */
  done: boolean;
}

/**
 * Mọi thứ hai cột của voucher cần, tính sẵn một lần ở server (spec P7 §2.6, §6).
 *
 * Không mang giai đoạn: component không đọc nó — mọi thứ đi theo giai đoạn đã tính sẵn ở đây (mộc,
 * dải huỷ, mã vạch, điều kiện, nhật ký). Bản trước có cả `phase` lẫn `showCode` nói lại đúng điều
 * `cancelledNotice` đã nói (review P7C mục 15).
 */
export interface VoucherView {
  /** Vừa trả tiền: tiêu đề "… is booked." và pháo giấy. */
  justPaid: boolean;
  title: string;
  subtitle: string;
  /**
   * Mộc trạng thái ở cột trái — `bookingPass(…).stamp`, cùng luật với vé của trang chi tiết đơn:
   * đơn PAID trên chuyến công ty huỷ đóng mộc "CANCELLED", không "CONFIRMED".
   */
  stamp: BookingStamp;
  /** Điểm đến đầu tiên của tour; tour không có điểm đến thì là tên tour. */
  place: string;
  /** Số ngày của chuyến, tính cả ngày đi lẫn ngày về. */
  tripDays: number;
  /** Ngày đi — một ngày ("3 Nov 2026") hoặc một khoảng ("3–5 Nov 2026"). */
  departure: string;
  /** Tên cổng thanh toán như trang chi tiết đơn in ("PayPal", "Card (Stripe)"). */
  provider: string;
  /** Ngày trả tiền đã định dạng. */
  paidOn: string;
  /**
   * Dải thay ô mã khi voucher hết hiệu lực (giai đoạn `cancelled`, `bookingPass(…).voucher` sai).
   * `null` là voucher còn hiệu lực: có ô mã kèm ngày đi, "Admit n" và các dòng điều kiện.
   */
  cancelledNotice: string | null;
  /**
   * Có mã vạch — `bookingPass(…).barcode`: chỉ khi mã còn để chìa ra ở điểm đón (sắp đi, đang đi).
   */
  showBarcode: boolean;
  /** Các dòng điều kiện có dấu tích dưới ô mã, đúng thứ tự bảng §2.6; rỗng khi đã huỷ. */
  conditions: string[];
  /** Ba mốc nhật ký (hai khi mốc cuối không có gì thật để nói). */
  journal: VoucherJournalItem[];
}

/**
 * Bảng quyết định của voucher `/checkout/success` (spec P7 §2.6) — hàm THUẦN, component chỉ vẽ.
 *
 * Trả `null` khi đơn chưa có `paidAt`: đơn PENDING đang chờ webhook, hay giữ chỗ đã hết hạn rồi
 * bị huỷ khi chưa trả. Những đơn ấy giữ nguyên hoá đơn chờ (`BookingReceipt`) — mã của chúng
 * chưa bao giờ là voucher.
 *
 * `now` là đồng hồ server web, trang đọc MỘT lần: vừa đo 30 phút "vừa trả" vừa suy hôm nay —
 * ngày lịch Việt Nam (`vietnamToday`, spec P7 §2.1) mà giai đoạn đọc qua `bookingPhase` của
 * contract như mọi trang đơn của đợt P7. Bản trước nhận thêm `today` đọc riêng từ đồng hồ thứ hai
 * (review P7C mục 17).
 */
export function voucherView(booking: BookingDetail, now: Date): VoucherView | null {
  const paidAt = booking.paidAt;
  if (paidAt === null) return null;
  const phase = bookingPhase(booking, vietnamToday(now));
  // Không xảy ra với đơn đã có `paidAt`; nhánh này thu hẹp kiểu cho `switch` bên dưới.
  if (phase === 'awaiting_payment' || phase === 'lapsed') return null;

  const t = messages.voucher;
  const place = booking.tourDestinations[0]?.name ?? booking.tourTitle;
  const isDayTrip = booking.departureStartDate === booking.departureEndDate;
  // `formatDateRange` tự in MỘT ngày khi ngày đi trùng ngày về ("3 Nov 2026").
  const departure = formatDateRange(booking.departureStartDate, booking.departureEndDate);
  const paidOn = formatDate(vietnamDay(paidAt));
  const provider = paymentProviderLabel(booking.paymentProvider);
  // Ô mã khi voucher còn hiệu lực, mã vạch chỉ khi còn cổng để quét (sắp đi, đang đi), mộc theo
  // giai đoạn — luật chung với vé và nút "View voucher" của trang chi tiết đơn.
  const pass = bookingPass(booking, phase);
  // Chỉ đơn PAID còn voucher: đơn đã huỷ (kể cả chuyến công ty huỷ khi đơn còn PAID) hay đã hoàn
  // một phần trong 30 phút đầu không có gì để chúc mừng. Hiệu âm (đồng hồ API nhanh hơn web vài
  // giây) vẫn là vừa trả.
  const justPaid =
    pass.voucher &&
    booking.status === 'PAID' &&
    now.getTime() - Date.parse(paidAt) <= VOUCHER_FRESH_MINUTES * 60_000;

  const common = {
    justPaid,
    stamp: pass.stamp,
    showBarcode: pass.barcode,
    title: justPaid
      ? isDayTrip
        ? t.freshDayTitle(place)
        : t.freshTripTitle(place)
      : t.reopenedTitle,
    subtitle: justPaid
      ? t.freshSub(booking.code, booking.contactEmail)
      : t.reopenedSub(formatDate(vietnamDay(booking.createdAt)), booking.contactEmail),
    place,
    tripDays: tripLengthDays(booking.departureStartDate, booking.departureEndDate),
    departure,
    provider,
    paidOn,
  };
  const bookedAndPaid: VoucherJournalItem = {
    label: t.journal.bookedAndPaid,
    detail: `${paidOn} · ${provider}`,
    done: true,
  };
  const taxes = messages.checkoutSummary.taxesNote;

  switch (phase) {
    case 'upcoming': {
      // Hạn huỷ chỉ theo thông tin huỷ của SERVER (`bookings.byCode.cancellation`, ADR-0041 §7):
      // còn hạn là cờ `withinDeadline` (`freeCancellationOpen`), ngày chót là ngày server tính —
      // không tự so ngày chót với hôm nay. Vắng thông tin ấy (đơn hoàn thiện chí trọn: không còn gì
      // để huỷ hay hoàn) thì không có gì thật để nói về hạn huỷ — không dòng điều kiện, không mốc
      // nhật ký: "ended" cho một ngày chưa tới là nói sai. Cùng luật mốc Free cancellation của thanh
      // hành trình trang chi tiết đơn.
      const deadline =
        booking.cancellation === null ? null : formatChipDate(booking.cancellation.deadline);
      const open = deadline !== null && freeCancellationOpen(booking);
      return {
        ...common,
        // Quá hạn thì BỎ dòng hạn huỷ: một dấu tích cạnh "đã hết hạn" đọc như một quyền lợi.
        conditions: open
          ? [t.showCode, messages.cancellationDeadline.full(deadline), taxes]
          : [t.showCode, taxes],
        journal: [
          bookedAndPaid,
          ...(deadline === null
            ? []
            : [
                {
                  label: open ? t.journal.freeCancellationEnds : t.journal.freeCancellationEnded,
                  detail: t.journal.deadlineAt(deadline),
                  done: !open,
                },
              ]),
          {
            label: t.journal.pickupDay,
            detail: `${formatDate(booking.departureStartDate)} · ${place}`,
            done: false,
          },
        ],
        cancelledNotice: null,
      };
    }
    case 'on_tour':
      return {
        ...common,
        conditions: [t.showCode, taxes],
        journal: [
          bookedAndPaid,
          {
            label: t.journal.tripStarted,
            detail: formatDate(booking.departureStartDate),
            done: true,
          },
          { label: t.journal.tripEnds, detail: formatDate(booking.departureEndDate), done: false },
        ],
        cancelledNotice: null,
      };
    case 'travelled':
      return {
        ...common,
        conditions: [taxes],
        journal: [
          bookedAndPaid,
          { label: t.journal.travelled, detail: departure, done: true },
          ...reviewJournal(booking, now),
        ],
        cancelledNotice: null,
      };
    case 'cancelled': {
      // Cùng luật ngày huỷ với thanh hành trình của trang chi tiết đơn (`cancelledOn`).
      const cancelledDay = cancelledOn(booking);
      return {
        ...common,
        conditions: [],
        journal: [
          {
            label: t.journal.booked,
            detail: formatDate(vietnamDay(booking.createdAt)),
            done: true,
          },
          {
            label: t.journal.cancelled,
            detail: cancelledDay === null ? null : formatDate(cancelledDay),
            done: true,
          },
          ...refundJournal(booking),
        ],
        // Chuyến bị CÔNG TY huỷ nói đúng ai huỷ — cùng luật (`cancelledByOperator`) và cùng câu với
        // cột phải của trang chi tiết đơn (ADR-0041 AMEND 1).
        cancelledNotice: cancelledByOperator(booking)
          ? t.departureCancelledNotice
          : t.cancelledNotice,
      };
    }
  }
}

/**
 * Mốc Refund của voucher đã huỷ — cùng chuyện tiền với cột phải của trang chi tiết đơn
 * (`TripClosedPanel`). Chuyến công ty huỷ mà job hoàn tiền chưa chạy (`operatorRefundPending`, đơn
 * còn PAID hay hoàn một phần): tiền đang về, sổ chưa ghi khoản hoàn nên chưa có số để kể. Còn lại
 * là câu `refundSentence` của khoản đã hoàn hay "không hoàn đồng nào"; đơn chưa từng thu thì không
 * có mốc này (`refundSummary` là `null`).
 */
function refundJournal(booking: BookingDetail): VoucherJournalItem[] {
  const t = messages.voucher.journal;
  if (operatorRefundPending(booking)) {
    return [{ label: t.refund, detail: messages.bookingDetail.closed.refundOnItsWay, done: false }];
  }
  const refund = refundSummary(booking);
  if (refund === null) return [];
  return [
    {
      label: t.refund,
      detail: refundSentence(refund, booking.currency),
      // Không hoàn đồng nào thì chưa có gì "xảy ra" để đánh dấu.
      done: refund.kind !== 'none',
    },
  ];
}

/**
 * Mốc thứ ba của chuyến đã đi — theo PHÁN QUYẾT của review qua `reviewSlot` (cổng của API, cùng
 * luật khu review của trang chi tiết đơn), không theo mốc `reviewedAt`: `bookings.byCode` đặt
 * `reviewedAt` là ngày viết cho MỌI review, nên bản trước vẫn đánh ✓ "Reviewed" cho bài bị bác
 * hay đã rút (review P7C#2).
 *
 * - Đã duyệt, đang chờ duyệt: khách ĐÃ viết — "Reviewed" ✓ kèm ngày viết (spec §2.6).
 * - Chưa viết mà đủ điều kiện (`form` — cổng `checkReviewEligibility` chỉ nhận PAID), hay bị bác
 *   mà còn lượt viết lại: mời viết.
 * - Bị bác hết lượt, đã rút, hay không đủ điều kiện (đơn hoàn một phần chưa viết gì): không có
 *   mốc thứ ba nào nói thật được.
 *
 * `now` là đồng hồ của `voucherView` — một lần render chỉ có một "bây giờ".
 */
function reviewJournal(booking: BookingDetail, now: Date): VoucherJournalItem[] {
  const t = messages.voucher.journal;
  switch (reviewSlot(booking, now)) {
    case 'approved':
    case 'pending': {
      // Hai slot này chỉ có khi đơn mang review (`reviewSlot` đọc `booking.review` trước tiên).
      const writtenAt = booking.review?.createdAt;
      return writtenAt === undefined
        ? []
        : [{ label: t.reviewed, detail: formatDate(vietnamDay(writtenAt)), done: true }];
    }
    case 'form':
    case 'rejected':
      return [
        {
          label: t.writeReview,
          detail: messages.accountBookingDetail.sections.reviewBlurb,
          done: false,
        },
      ];
    case 'rejectedFinal':
    case 'retracted':
    case 'tooEarly':
    case 'hidden':
      return [];
  }
}
