import {
  type BookingDetail,
  type BookingPhase,
  bookingPhase,
  tripLengthDays,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  cancelledOn,
  freeCancellationOpen,
  paymentProviderLabel,
  refundSentence,
  refundSummary,
  vietnamDay,
} from './booking-vm';
import { formatChipDate, formatDate, formatDateRange } from './tours';

/**
 * Voucher còn "vừa trả tiền" trong bao nhiêu phút kể từ `paidAt` (spec P7 §2.6).
 *
 * Trong khoảng này trang chào "… is booked." và bắn pháo giấy; quá nó là khách MỞ LẠI voucher
 * (từ email, từ "View voucher") — lúc ấy chúc mừng hay hứa "email đang tới" là nói sai. Đo bằng
 * đồng hồ của server web lúc render, không bằng đồng hồ máy khách.
 */
export const VOUCHER_FRESH_MINUTES = 30;

/** Đơn đã có `paidAt` chỉ rơi vào bốn giai đoạn này (`awaiting_payment`, `lapsed` là của PENDING). */
export type VoucherPhase = Extract<
  BookingPhase,
  'upcoming' | 'on_tour' | 'travelled' | 'cancelled'
>;

/** Một mốc của "Trip journal" ở mảng teal. */
export interface VoucherJournalItem {
  label: string;
  /** Dòng nhỏ dưới nhãn (ngày, cổng, số tiền) — `null` khi không có gì đáng in. */
  detail: string | null;
  /** Mốc đã xảy ra: vẽ dấu tích. */
  done: boolean;
}

/** Mọi thứ hai cột của voucher cần, tính sẵn một lần ở server (spec P7 §2.6, §6). */
export interface VoucherView {
  phase: VoucherPhase;
  /** Vừa trả tiền: tiêu đề "… is booked." và pháo giấy. */
  justPaid: boolean;
  title: string;
  subtitle: string;
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
  /** Có ô mã đơn (kèm ngày đi, "Admit n", dòng điều kiện) — đơn đã huỷ thì không. */
  showCode: boolean;
  /** Có mã vạch — chỉ khi mã còn để chìa ra ở điểm đón (sắp đi, đang đi). */
  showBarcode: boolean;
  /** Các dòng điều kiện có dấu tích dưới ô mã, đúng thứ tự bảng §2.6. */
  conditions: string[];
  /** Ba mốc nhật ký (hai khi mốc cuối không có gì thật để nói). */
  journal: VoucherJournalItem[];
  /** Dải thay ô mã khi đơn đã huỷ; `null` ở các giai đoạn còn hiệu lực. */
  cancelledNotice: string | null;
}

/**
 * Bảng quyết định của voucher `/checkout/success` (spec P7 §2.6) — hàm THUẦN, component chỉ vẽ.
 *
 * Trả `null` khi đơn chưa có `paidAt`: đơn PENDING đang chờ webhook, hay giữ chỗ đã hết hạn rồi
 * bị huỷ khi chưa trả. Những đơn ấy giữ nguyên hoá đơn chờ (`BookingReceipt`) — mã của chúng
 * chưa bao giờ là voucher.
 *
 * `today` là ngày lịch Việt Nam do server tính (`todayDateString`); giai đoạn đọc qua
 * `bookingPhase` của contract như mọi trang đơn của đợt P7. `now` chỉ để đo 30 phút "vừa trả".
 */
export function voucherView(booking: BookingDetail, now: Date, today: string): VoucherView | null {
  const paidAt = booking.paidAt;
  if (paidAt === null) return null;
  const phase = bookingPhase(booking, today);
  // Không xảy ra với đơn đã có `paidAt`; nhánh này thu hẹp kiểu cho `switch` bên dưới.
  if (phase === 'awaiting_payment' || phase === 'lapsed') return null;

  const t = messages.voucher;
  const place = booking.tourDestinations[0]?.name ?? booking.tourTitle;
  const isDayTrip = booking.departureStartDate === booking.departureEndDate;
  const departure = isDayTrip
    ? formatDate(booking.departureStartDate)
    : formatDateRange(booking.departureStartDate, booking.departureEndDate);
  const paidOn = formatDate(vietnamDay(paidAt));
  const provider = paymentProviderLabel(booking.paymentProvider);
  // Chỉ PAID: đơn đã huỷ hay đã hoàn một phần trong 30 phút đầu không có gì để chúc mừng.
  // Hiệu âm (đồng hồ API nhanh hơn web vài giây) vẫn là vừa trả.
  const justPaid =
    booking.status === 'PAID' &&
    now.getTime() - Date.parse(paidAt) <= VOUCHER_FRESH_MINUTES * 60_000;

  const common = {
    justPaid,
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
      // Chỉ cờ SERVER (`bookings.byCode.cancellation`, ADR-0041 §7): vắng cờ — đơn hoàn thiện chí
      // trọn — là hết quyền huỷ miễn phí, không tự so ngày chót (`freeCancellationOpen`).
      const withinDeadline = freeCancellationOpen(booking);
      const deadline = formatChipDate(booking.cancellationDeadline);
      return {
        ...common,
        phase,
        showCode: true,
        showBarcode: true,
        // Quá hạn thì BỎ dòng hạn huỷ: một dấu tích cạnh "đã hết hạn" đọc như một quyền lợi.
        conditions: withinDeadline
          ? [t.showCode, messages.cancellationDeadline.full(deadline), taxes]
          : [t.showCode, taxes],
        journal: [
          bookedAndPaid,
          {
            label: withinDeadline
              ? t.journal.freeCancellationEnds
              : t.journal.freeCancellationEnded,
            detail: t.journal.deadlineAt(deadline),
            done: !withinDeadline,
          },
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
        phase,
        showCode: true,
        showBarcode: true,
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
    case 'travelled': {
      // "Write a review" chỉ cho PAID — cổng `checkReviewEligibility` của API nhận đúng PAID.
      // Đơn đã hoàn một phần chưa viết gì thì không có mốc thứ ba nào nói thật được.
      const review: VoucherJournalItem[] =
        booking.reviewedAt !== null
          ? [
              {
                label: t.journal.reviewed,
                detail: formatDate(vietnamDay(booking.reviewedAt)),
                done: true,
              },
            ]
          : booking.status === 'PAID'
            ? [
                {
                  label: t.journal.writeReview,
                  detail: messages.accountBookingDetail.sections.reviewBlurb,
                  done: false,
                },
              ]
            : [];
      return {
        ...common,
        phase,
        showCode: true,
        // Chuyến đã xong: mã không còn để quét ở cổng nào.
        showBarcode: false,
        conditions: [taxes],
        journal: [
          bookedAndPaid,
          { label: t.journal.travelled, detail: departure, done: true },
          ...review,
        ],
        cancelledNotice: null,
      };
    }
    case 'cancelled': {
      // Cùng luật ngày huỷ với thanh hành trình của trang chi tiết đơn (`cancelledOn`).
      const cancelledDay = cancelledOn(booking);
      const refund = refundSummary(booking);
      return {
        ...common,
        phase,
        showCode: false,
        showBarcode: false,
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
          ...(refund === null
            ? []
            : [
                {
                  label: t.journal.refund,
                  // Cùng câu với cột phải của trang chi tiết đơn đã huỷ.
                  detail: refundSentence(refund, booking.currency),
                  // Không hoàn đồng nào thì chưa có gì "xảy ra" để đánh dấu.
                  done: refund.kind !== 'none',
                },
              ]),
        ],
        cancelledNotice: t.cancelledNotice,
      };
    }
  }
}
