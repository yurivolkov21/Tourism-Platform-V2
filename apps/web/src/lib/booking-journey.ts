import {
  type BookingDetail,
  type BookingPhase,
  bookingPhase,
  calendarDaysBetween,
  tripDayNumbers,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  cancelledOn,
  freeCancellationOpen,
  type RefundSummary,
  refundSummary,
  vietnamDay,
} from './booking-vm';
import { formatChipDate, formatDate, formatMoneyExact, formatWeekdayDate } from './tours';

/**
 * Thanh hành trình của trang chi tiết đơn (spec P7 §2.2) — hàm thuần, component chỉ vẽ.
 *
 * Ba biến thể theo giai đoạn (`bookingPhase`, ADR-0054 §1):
 * - `standard` — chờ trả, sắp đi, đang đi, đã đi: Booked → Paid → Free cancellation →
 *   Departure → Trip ends, có nhãn Today ở ba giai đoạn đầu (mốc Free cancellation chỉ khi có
 *   điều thật để nói — `freeCancellationStep`);
 * - `cancelled` — Booked → Paid (nếu đã trả) → Cancelled → Refund (nếu từng thu tiền);
 * - `lapsed` — Booked → Payment not completed.
 *
 * "Hôm nay" là ngày lịch Việt Nam do server tính (`todayDateString`), so bằng chuỗi
 * `YYYY-MM-DD` — không bao giờ giờ máy khách (spec §2.1).
 */
export type JourneyVariant = 'standard' | 'cancelled' | 'lapsed';

export type MilestoneKey =
  | 'booked'
  | 'paid'
  | 'freeCancellation'
  | 'departure'
  | 'tripEnds'
  | 'cancelled'
  | 'refund'
  | 'paymentNotCompleted';

/** `done` đã qua · `now` mốc chưa xong ĐẦU TIÊN · `next` các mốc chưa xong sau nó. */
export type MilestoneState = 'done' | 'now' | 'next';

export interface JourneyMilestone {
  key: MilestoneKey;
  label: string;
  /** Dòng nhỏ dưới nhãn: ngày hoặc số tiền; `null` khi không có gì đáng in. */
  detail: string | null;
  state: MilestoneState;
}

/** Tông chip góc phải — component tra bảng class token theo tông. */
export type JourneyChipTone = 'active' | 'done' | 'warning' | 'muted';

export interface JourneyChip {
  label: string;
  tone: JourneyChipTone;
}

export interface JourneyView {
  variant: JourneyVariant;
  milestones: JourneyMilestone[];
  /**
   * Nhãn Today. `percent` là vị trí ĐÚNG tỷ lệ ngày trên vạch nối (0 = tâm mốc đầu, 100 = tâm mốc
   * cuối) — chưa né icon: nhãn đặt sát mốc thì đè icon, và khoảng né tính bằng px nên chỉ component
   * làm được (`TripJourney`). `before` là chỉ số mốc mà dòng Today chen TRƯỚC ở danh sách dọc của
   * điện thoại — cũng là mốc ngay sau nhãn trên vạch ngang. `null` ngoài ba giai đoạn chờ trả, sắp
   * đi, đang đi; khi ấy vạch tô trọn.
   */
  today: { percent: number; before: number } | null;
  chip: JourneyChip | null;
}

/** Mốc trước khi gắn trạng thái; `date` là ngày lịch dùng đặt nhãn Today (`null`: chưa có ngày). */
interface DraftMilestone {
  key: MilestoneKey;
  label: string;
  detail: string | null;
  done: boolean;
  date: string | null;
}

type StandardPhase = Exclude<BookingPhase, 'cancelled' | 'lapsed'>;

export function journeyMilestones(booking: BookingDetail, today: string): JourneyView {
  const phase = bookingPhase(booking, today);
  if (phase === 'cancelled') return cancelledJourney(booking);
  if (phase === 'lapsed') return lapsedJourney(booking);
  return standardJourney(booking, phase, today);
}

function standardJourney(booking: BookingDetail, phase: StandardPhase, today: string): JourneyView {
  const t = messages.bookingDetail.journey;
  // Ngày lịch VN của hai mốc — cũng là mốc đặt nhãn Today, cùng thang với `today`.
  const bookedOn = vietnamDay(booking.createdAt);
  const paidOn = booking.paidAt ? vietnamDay(booking.paidAt) : null;
  const departed = booking.departureStartDate <= today;
  // Ngày về khách VẪN đang đi (chip "Day D of D"): chỉ "Trip ended" khi chuyến đã qua.
  const ended = phase === 'travelled';

  const drafts: DraftMilestone[] = [
    {
      key: 'booked',
      label: messages.bookingDetail.booked,
      detail: formatDate(bookedOn),
      done: true,
      date: bookedOn,
    },
    {
      key: 'paid',
      label: t.paid,
      detail: paidOn ? formatDate(paidOn) : t.awaitingPayment,
      done: paidOn !== null,
      date: paidOn,
    },
    ...freeCancellationStep(booking, phase),
    {
      key: 'departure',
      label: departed ? t.departed : t.departure,
      detail: formatWeekdayDate(booking.departureStartDate),
      done: departed,
      date: booking.departureStartDate,
    },
    {
      key: 'tripEnds',
      label: ended ? t.tripEnded : t.tripEnds,
      detail: formatWeekdayDate(booking.departureEndDate),
      done: ended,
      date: booking.departureEndDate,
    },
  ];

  return {
    variant: 'standard',
    milestones: withStates(drafts),
    today: phase === 'travelled' ? null : todayMark(drafts, today),
    chip: standardChip(booking, phase, today),
  };
}

/**
 * Mốc Free cancellation — chỉ khi có điều thật để nói. Còn hạn huỷ chỉ theo cờ server
 * (`freeCancellationOpen`, ADR-0041 §7), ngày chót là ngày server tính.
 *
 * Hai nguồn: thông tin huỷ của server (`cancellation` — đơn PAID hay hoàn một phần trên chuyến còn
 * chạy), hay đơn chờ trả — giai đoạn `awaiting_payment` CHÍNH là "chưa qua hạn chót" theo luật
 * giai đoạn chung, nên mốc vẫn mở mà web không tự so ngày. Vắng cả hai (đơn hoàn thiện chí trọn:
 * không còn gì để huỷ hay hoàn) thì BỎ mốc: "Until …" là hứa một quyền huỷ không còn, "Ended {ngày}"
 * cho một ngày chưa tới là nói sai.
 */
function freeCancellationStep(booking: BookingDetail, phase: StandardPhase): DraftMilestone[] {
  if (booking.cancellation === null && phase !== 'awaiting_payment') return [];
  const t = messages.bookingDetail.journey;
  const deadline = booking.cancellation?.deadline ?? booking.cancellationDeadline;
  const open = phase === 'awaiting_payment' || freeCancellationOpen(booking);
  return [
    {
      key: 'freeCancellation',
      label: messages.checkoutSummary.freeCancellation,
      detail: open ? t.until(formatWeekdayDate(deadline)) : t.ended(formatChipDate(deadline)),
      done: !open,
      date: deadline,
    },
  ];
}

/** Mốc chưa xong ĐẦU TIÊN là "now", các mốc chưa xong còn lại là "next" (spec §2.2). */
function withStates(drafts: readonly DraftMilestone[]): JourneyMilestone[] {
  const firstOpen = drafts.findIndex((draft) => !draft.done);
  return drafts.map(({ key, label, detail, done }, index) => ({
    key,
    label,
    detail,
    state: done ? 'done' : index === firstOpen ? 'now' : 'next',
  }));
}

/**
 * Today nằm trên vạch giữa mốc xong CUỐI CÙNG và mốc kế tiếp, theo tỷ lệ số ngày (spec §2.2).
 * Mốc kế tiếp chưa có ngày (Paid của đơn chưa trả) thì đứng giữa đoạn. Tỷ lệ chỉ kẹp trong đoạn
 * ([0, 1] — cờ huỷ của server và ngày lịch có thể lệch nhau một chút); né icon mốc là việc của
 * component, theo px (review P7 B21: kẹp 20% đoạn ở đây vẫn đè icon tới 22px ở 768px).
 */
function todayMark(
  drafts: readonly DraftMilestone[],
  today: string,
): { percent: number; before: number } | null {
  const lastDone = drafts.findLastIndex((draft) => draft.done);
  const from = drafts[lastDone];
  const to = drafts[lastDone + 1];
  if (!from || !to) return null;
  const span = from.date && to.date ? calendarDaysBetween(from.date, to.date) : 0;
  const ratio = span > 0 && from.date ? calendarDaysBetween(from.date, today) / span : 0.5;
  const clamped = Math.min(1, Math.max(0, ratio));
  const percent = ((lastDone + clamped) * 100) / (drafts.length - 1);
  // Làm tròn hai chữ số: phép chia số thực cho ra 41.250000000000007.
  return { percent: Math.round(percent * 100) / 100, before: lastDone + 1 };
}

function standardChip(booking: BookingDetail, phase: StandardPhase, today: string): JourneyChip {
  const t = messages.bookingDetail.journey;
  const { daysToGo, dayOfTrip, tripLength } = tripDayNumbers(booking, today);
  switch (phase) {
    case 'awaiting_payment':
      return { label: t.awaitingPayment, tone: 'warning' };
    case 'upcoming':
      return { label: t.departsIn(daysToGo), tone: 'active' };
    case 'on_tour':
      return { label: t.dayOf(dayOfTrip, tripLength), tone: 'active' };
    case 'travelled':
      return { label: t.completed, tone: 'done' };
  }
}

function cancelledJourney(booking: BookingDetail): JourneyView {
  const t = messages.bookingDetail.journey;
  // Không mốc nào nói thật được thì bỏ ngày, không bịa (`cancelledOn`).
  const cancelledDay = cancelledOn(booking);
  const refund = refundSummary(booking);
  const milestones: JourneyMilestone[] = [
    {
      key: 'booked',
      label: messages.bookingDetail.booked,
      detail: formatDate(vietnamDay(booking.createdAt)),
      state: 'done',
    },
  ];
  if (booking.paidAt) {
    milestones.push({
      key: 'paid',
      label: t.paid,
      detail: formatDate(vietnamDay(booking.paidAt)),
      state: 'done',
    });
  }
  milestones.push({
    key: 'cancelled',
    label: t.cancelled,
    detail: cancelledDay ? formatDate(cancelledDay) : null,
    state: 'done',
  });
  // Đơn chưa từng thu tiền thì không có chuyện hoàn: `refundSummary` trả null, bỏ mốc Refund.
  if (refund) {
    milestones.push({
      key: 'refund',
      label: t.refund,
      detail: refundDetail(refund, booking.currency),
      state: 'done',
    });
  }
  return {
    variant: 'cancelled',
    milestones,
    today: null,
    chip: { label: t.cancelled, tone: 'muted' },
  };
}

/**
 * Dòng phụ của mốc Refund — bản NGẮN của `refundSentence` (chỉ số tiền, vừa một dòng dưới
 * mốc); số tiền thật nên `formatMoneyExact`, như mọi chỗ in tiền hoàn. `switch` đủ biến thể như
 * `refundSentence`: biến thể mới của `RefundSummary` là typecheck đỏ, không lặng lẽ thành
 * "No refund due" (review P7 B14).
 */
function refundDetail(refund: RefundSummary, currency: string): string {
  const t = messages.bookingDetail.journey;
  switch (refund.kind) {
    case 'full':
      return formatMoneyExact(refund.amount, currency);
    case 'partial':
      return t.refundPartial(
        formatMoneyExact(refund.amount, currency),
        formatMoneyExact(refund.total, currency),
      );
    case 'none':
      return t.refundNone;
  }
}

/**
 * Đơn chờ trả qua hạn chót: Booked → Payment not completed. Mốc sau là mốc ĐANG ĐỨNG (`now`),
 * không tô như đã xong: claim của API vẫn nhận phiên thanh toán mở trước hạn, trả xong thì đơn tự
 * sang PAID (ADR-0054 AMEND 1 §4) — đây chưa phải kết cục (review P7 S1).
 */
function lapsedJourney(booking: BookingDetail): JourneyView {
  const t = messages.bookingDetail.journey;
  return {
    variant: 'lapsed',
    milestones: [
      {
        key: 'booked',
        label: messages.bookingDetail.booked,
        detail: formatDate(vietnamDay(booking.createdAt)),
        state: 'done',
      },
      { key: 'paymentNotCompleted', label: t.paymentNotCompleted, detail: null, state: 'now' },
    ],
    today: null,
    chip: null,
  };
}
