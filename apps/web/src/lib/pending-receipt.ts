import {
  type BookingDetail,
  type BookingPhase,
  bookingPhase,
  tripLengthDays,
  VIETNAM_TIME_ZONE,
  vietnamToday,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatPrintDateTime, formatPrintTime } from '@tourism/ui/lib/print-time';
import {
  type BookingStamp,
  bookingPass,
  cancelledOn,
  closedNarrative,
  paymentProviderLabel,
  wasCharged,
} from './booking-vm';
import {
  bookingPriceLines,
  closedStubSentence,
  formatBookingMoney,
  type PriceLine,
  pendingDeadline,
  pendingExpiry,
  receiptNote,
} from './checkout';
import { formatDate, formatDateRange, formatMoneyExact, formatWeekdayDate } from './tours';
import { refundJournal, tripPlace, type VoucherJournalItem } from './voucher';

/** Trang đang dựng thẻ chờ: khách bấm huỷ ở cổng, hay về từ cổng trước webhook. */
export type PendingPage = 'cancel' | 'success';

/**
 * Bốn trạng thái của thẻ chờ (G42, spec 2026-10-13 §3):
 *
 * - `payable` — trang huỷ, đơn PENDING còn trong hạn chót: có Pay now.
 * - `confirming` — trang success, đơn PENDING: khách về trước webhook, trang tự làm tươi.
 * - `notPaid` — trang huỷ, đơn PENDING qua hạn chót (`lapsed`): CHƯA phải kết cục — claim của API
 *   còn nhận phiên mở trước hạn (ADR-0054 AMEND 1 §4) — nhưng không mở phiên mới được nữa.
 * - `closed` — đơn đã ở kết cục khác (huỷ, hết hạn, bị thu rồi hoàn tự động).
 */
export type PendingState = 'payable' | 'confirming' | 'notPaid' | 'closed';

/** Hành động chính của thẻ — vẽ ở ô gọn dưới `xl` và ở cột phải từ `xl`. */
export type PendingAction =
  | { kind: 'payNow' }
  /** `checking`: dòng "Checking with Stripe…" đứng cạnh nút Refresh. */
  | { kind: 'refresh'; checking: string }
  | { kind: 'bookAgain'; href: string };

/** Một ô có icon của lưới bốn ô. */
export interface PendingCell {
  title: string;
  body: string;
  /** Tông cảnh báo — chỉ ô hạn trả. */
  warn: boolean;
}

/**
 * Mọi thứ thẻ chờ cần, tính sẵn một lần ở server — component chỉ vẽ, không đọc `status` hay giai
 * đoạn (cùng cách `VoucherView` của voucher).
 */
export interface PendingView {
  state: PendingState;
  /** Mộc ở cột trái — `bookingPass(…).stamp`, trừ `confirming` (xem `pendingStamp`). */
  stamp: BookingStamp;
  title: string;
  subtitle: string;
  /** Điểm đến đầu tiên của tour, không có thì tên tour (`tripPlace`). */
  place: string;
  tripDays: number;
  /** Ngày đi — một ngày hay một khoảng ("29 Oct 2026"). */
  departure: string;
  /** Ảnh bìa xám: đơn không còn trả được trên trang này. */
  dimmed: boolean;
  /** Ô mốc thời gian: hạn trả khi còn hứa được, còn lại là giờ đặt. */
  timeCell: PendingCell;
  /** Nhãn cổng thanh toán ("Card (Stripe)"). */
  provider: string;
  codeLabel: string;
  /** Có dòng ngày đi và số khách dưới mã — chỉ khi đơn còn mở. */
  showMeta: boolean;
  /** Các dòng điều kiện dưới mã; rỗng khi không có câu nào nói thật được. */
  conditions: string[];
  /** Chữ của dải gạch chéo thay mã vạch. */
  band: string;
  priceLines: PriceLine[];
  total: PriceLine;
  /** Dòng sau tổng: "Charged · $0" (đóng mà chưa thu) hay "Refunded −$…" (bị thu rồi hoàn). */
  settlement: PriceLine | null;
  /** Có câu "Includes all taxes and fees." dưới tổng — chỉ khi còn khoản phải trả. */
  showTaxes: boolean;
  journal: VoucherJournalItem[];
  action: PendingAction;
}

/**
 * Bảng quyết định của thẻ chờ cho đơn CHƯA TRẢ (`paidAt` null) ở `/checkout/cancel` và
 * `/checkout/success` — hàm THUẦN. Đơn đã trả không tới đây: trang huỷ chuyển nó sang voucher
 * (`cancelPageRedirect`), trang success dựng voucher (`voucherView`).
 *
 * `now` là đồng hồ server web, trang đọc MỘT lần (cùng mốc với bản in B1 của trang): vừa suy hôm
 * nay theo lịch Việt Nam cho `bookingPhase`, vừa đo đơn đã qua mốc nhả chưa (`pendingExpiry`).
 */
export function pendingView(booking: BookingDetail, now: Date, page: PendingPage): PendingView {
  const phase = bookingPhase(booking, vietnamToday(now));
  const state = pendingState(booking, phase, page);
  const open = state === 'payable' || state === 'confirming';
  const s = messages.booking.success;
  const p = messages.pendingReceipt;
  const place = tripPlace(booking);
  const provider = paymentProviderLabel(booking.paymentProvider);
  const bookedAt = formatPrintDateTime(new Date(booking.createdAt), VIETNAM_TIME_ZONE);

  // Hạn trả chỉ hứa khi còn hứa được: qua mốc mà cron chưa quét thì API vẫn nhận trả (`reCheckout`
  // chỉ cần PENDING và chuyến còn nhận đặt) nhưng không còn giờ nào để nói (spec §3).
  const deadline = pendingDeadline(booking);
  const until =
    state === 'payable' && !pendingExpiry(booking, now).expired
      ? {
          time: formatPrintTime(deadline, VIETNAM_TIME_ZONE),
          day: formatWeekdayDate(vietnamToday(deadline)),
        }
      : null;
  const payBy =
    until === null ? null : `${messages.printDoc.receipt.payBy} ${until.time} · ${until.day}`;

  // Có dòng Refunded thì CẢ khối tiền đủ hai số lẻ — cùng luật khối receipt của voucher (thử tay
  // prod 09/10): "$39" trên "−$39.00" là hai độ chính xác trong một cột.
  const refunded = Number(booking.refundedTotal) > 0;
  const money = { exact: refunded };
  const charged = wasCharged(booking);

  const booked: VoucherJournalItem = {
    label: messages.voucher.journal.booked,
    detail: bookedAt,
    done: true,
  };
  const pickup: VoucherJournalItem = {
    label: messages.voucher.journal.pickupDay,
    detail: `${formatDate(booking.departureStartDate)} · ${place}`,
    done: false,
  };
  const bookAgain: PendingAction = { kind: 'bookAgain', href: `/tours/${booking.tourSlug}` };

  const common = {
    state,
    stamp: pendingStamp(booking, phase, state),
    place,
    tripDays: tripLengthDays(booking.departureStartDate, booking.departureEndDate),
    departure: formatDateRange(booking.departureStartDate, booking.departureEndDate),
    dimmed: !open,
    timeCell:
      payBy === null
        ? { title: messages.voucher.journal.booked, body: bookedAt, warn: false }
        : { title: payBy, body: p.payByNote, warn: true },
    provider,
    codeLabel: open ? p.codeLabel : messages.voucher.codeLabel,
    showMeta: open,
    priceLines: bookingPriceLines(booking, money),
    total: {
      label: open ? p.totalDue : messages.checkoutSummary.totalLabel,
      amount: formatBookingMoney(booking, booking.totalAmount, money),
    },
    settlement: refunded
      ? {
          label: messages.voucher.refunded,
          amount: messages.voucher.refundedAmount(
            formatMoneyExact(booking.refundedTotal, booking.currency),
          ),
        }
      : state === 'closed' && !charged
        ? { label: p.charged, amount: formatBookingMoney(booking, '0', money) }
        : null,
    showTaxes: open,
  };

  switch (state) {
    case 'payable':
      return {
        ...common,
        title: messages.booking.cancel.title,
        subtitle: p.heldNote(until),
        conditions: [s.stubNotYetVoucher, p.seatsNotHeld],
        band: messages.printDoc.receipt.unpaid,
        journal: [
          booked,
          { label: messages.bookingDetail.journey.awaitingPayment, detail: payBy, done: false },
          pickup,
        ],
        action: { kind: 'payNow' },
      };
    case 'confirming':
      return {
        ...common,
        title: s.pendingTitle,
        subtitle: s.pendingBody,
        conditions: [s.stubNotYetVoucher],
        band: s.statusConfirming,
        journal: [booked, { label: s.statusConfirming, detail: provider, done: false }, pickup],
        action: { kind: 'refresh', checking: p.checkingWith[booking.paymentProvider] },
      };
    case 'notPaid': {
      // Cùng câu với cột phải trang chi tiết đơn và bản in (`closedNarrative`): câu sự việc rồi câu
      // điều kiện, không khẳng định "đã lỡ".
      const story = closedNarrative(booking, 'lapsed');
      return {
        ...common,
        title: story.title,
        subtitle: [story.headline, story.note].filter((part) => part !== null).join(' '),
        // Không hứa thành voucher, cũng không khẳng định "no payment was taken" — cùng luật dòng xé
        // của bản in B1 cho đơn quá hạn.
        conditions: [],
        band: messages.bookingDetail.ticket.notPaid,
        // Như `lapsedJourney` của trang chi tiết đơn: mốc sau là mốc đang đứng, không tô như đã xong.
        journal: [booked, { label: story.title, detail: null, done: false }],
        action: bookAgain,
      };
    }
    case 'closed': {
      const ended = cancelledOn(booking);
      return {
        ...common,
        title: p.closedTitle,
        subtitle: receiptNote(booking, 'settled'),
        conditions: [closedStubSentence(booking)],
        // Bị thu rồi hoàn: dải nói trạng thái đơn như cuống bản in, không "Closed" trần.
        band: charged
          ? (messages.booking.list.status[booking.status] ?? messages.printDoc.receipt.stampClosed)
          : messages.printDoc.receipt.stampClosed,
        journal: [
          booked,
          {
            label: closedNarrative(booking, 'cancelled').title,
            detail: ended === null ? null : formatDate(ended),
            done: true,
          },
          ...refundJournal(booking),
        ],
        action: bookAgain,
      };
    }
  }
}

/**
 * Trạng thái theo trang và giai đoạn. Đơn PENDING trên chuyến công ty vừa huỷ (giai đoạn
 * `cancelled`, một nhịp trước khi lõi huỷ đóng đơn) ở trang huỷ là `closed`: Pay now chắc chắn bị
 * từ chối (`DEPARTURE_NOT_AVAILABLE`). Ở trang success nó vẫn `confirming` — khách vừa trả, webhook
 * sẽ kể kết cục và trang tự làm tươi.
 */
function pendingState(
  booking: Pick<BookingDetail, 'status'>,
  phase: BookingPhase,
  page: PendingPage,
): PendingState {
  if (booking.status !== 'PENDING') return 'closed';
  if (page === 'success') return 'confirming';
  switch (phase) {
    case 'awaiting_payment':
      return 'payable';
    case 'lapsed':
      return 'notPaid';
    default:
      return 'closed';
  }
}

/**
 * Mộc của thẻ — `bookingPass` như vé và voucher, để một đơn mang cùng mộc ở mọi nơi. Riêng
 * `confirming` luôn là mộc chờ trả: khách vừa trả xong một phiên mở trước hạn chót (claim còn nhận,
 * ADR-0054 AMEND 1 §4) mà thấy NOT PAID cạnh "Confirming your payment…" là hai câu ngược nhau.
 */
function pendingStamp(
  booking: Pick<BookingDetail, 'paidAt' | 'status'>,
  phase: BookingPhase,
  state: PendingState,
): BookingStamp {
  return bookingPass(booking, state === 'confirming' ? 'awaiting_payment' : phase).stamp;
}
