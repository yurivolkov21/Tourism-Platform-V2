import {
  type BookingDetail,
  type BookingPhase,
  bookingPhase,
  calendarDaysBetween,
  tripDayNumbers,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { type RefundSummary, refundSummary } from './booking-vm';
import { formatChipDate, formatDate, formatMoneyExact, formatWeekdayDate } from './tours';

/**
 * Thanh hành trình của trang chi tiết đơn (spec P7 §2.2) — hàm thuần, component chỉ vẽ.
 *
 * Ba biến thể theo giai đoạn (`bookingPhase`, ADR-0054 §1):
 * - `standard` — chờ trả, sắp đi, đang đi, đã đi: Booked → Paid → Free cancellation →
 *   Departure → Trip ends, có nhãn Today ở ba giai đoạn đầu;
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
   * Nhãn Today. `percent` là vị trí trên vạch nối (0 = tâm mốc đầu, 100 = tâm mốc cuối);
   * `before` là chỉ số mốc mà dòng Today chen TRƯỚC ở danh sách dọc của điện thoại.
   * `null` ngoài ba giai đoạn chờ trả, sắp đi, đang đi.
   */
  today: { percent: number; before: number } | null;
  /** Phần vạch đã tô, cùng thang với `today.percent`. */
  fillPercent: number;
  chip: JourneyChip | null;
}

/**
 * Nhãn Today không sát mốc hơn 20% một đoạn: icon mốc rộng 40px, nhãn rộng ~50px — đặt đúng
 * tỷ lệ ở biên là nhãn đè lên icon. Lệch tối đa 20% đoạn, đổi lấy chữ đọc được.
 */
const TODAY_MIN = 0.2;
const TODAY_MAX = 0.8;

/** Mốc trước khi gắn trạng thái; `date` là ngày lịch dùng đặt nhãn Today (`null`: chưa có ngày). */
interface DraftMilestone {
  key: MilestoneKey;
  label: string;
  detail: string | null;
  done: boolean;
  date: string | null;
}

type StandardPhase = Exclude<BookingPhase, 'cancelled' | 'lapsed'>;

/** Phần ngày của một mốc ISO đầy đủ — cùng cách cắt với các dòng "Booked …" có sẵn của repo. */
const isoDay = (iso: string): string => iso.slice(0, 10);

export function journeyMilestones(booking: BookingDetail, today: string): JourneyView {
  const phase = bookingPhase(booking, today);
  if (phase === 'cancelled') return cancelledJourney(booking);
  if (phase === 'lapsed') return lapsedJourney(booking);
  return standardJourney(booking, phase, today);
}

function standardJourney(booking: BookingDetail, phase: StandardPhase, today: string): JourneyView {
  const t = messages.bookingDetail.journey;
  const bookedOn = isoDay(booking.createdAt);
  const paidOn = booking.paidAt ? isoDay(booking.paidAt) : null;
  const deadline = booking.cancellation?.deadline ?? booking.cancellationDeadline;
  // Hạn chót hết lúc 23:59 giờ VN của ngày chót: đúng ngày chót vẫn còn hạn. Có cờ server thì
  // in cờ server (ADR-0041 §7); đơn chưa trả không có `cancellation` nên so ngày lịch VN.
  const cancellationOpen = booking.cancellation
    ? booking.cancellation.withinDeadline
    : today <= deadline;
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
    {
      key: 'freeCancellation',
      label: messages.checkoutSummary.freeCancellation,
      detail: cancellationOpen
        ? t.until(formatWeekdayDate(deadline))
        : t.ended(formatChipDate(deadline)),
      done: !cancellationOpen,
      date: deadline,
    },
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

  const mark = phase === 'travelled' ? null : todayMark(drafts, today);
  return {
    variant: 'standard',
    milestones: withStates(drafts),
    today: mark,
    fillPercent: mark ? mark.percent : 100,
    chip: standardChip(booking, phase, today),
  };
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
 * Mốc kế tiếp chưa có ngày (Paid của đơn chưa trả) thì đứng giữa đoạn.
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
  const clamped = Math.min(TODAY_MAX, Math.max(TODAY_MIN, ratio));
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
  // `cancelledAt` có ở MỌI đường huỷ (khách huỷ, quét giữ chỗ, huỷ chuyến); hai mốc của đơn
  // xin huỷ chỉ có khi khách tự huỷ đơn đã trả. Không còn mốc nào thì bỏ ngày, không bịa.
  const cancelledOn =
    booking.cancelledAt ?? booking.cancellationDecidedAt ?? booking.cancellationRequestedAt;
  const refund = refundSummary(booking);
  const milestones: JourneyMilestone[] = [
    {
      key: 'booked',
      label: messages.bookingDetail.booked,
      detail: formatDate(isoDay(booking.createdAt)),
      state: 'done',
    },
  ];
  if (booking.paidAt) {
    milestones.push({
      key: 'paid',
      label: t.paid,
      detail: formatDate(isoDay(booking.paidAt)),
      state: 'done',
    });
  }
  milestones.push({
    key: 'cancelled',
    label: t.cancelled,
    detail: cancelledOn ? formatDate(isoDay(cancelledOn)) : null,
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
    fillPercent: 100,
    chip: { label: t.cancelled, tone: 'muted' },
  };
}

/** Dòng phụ của mốc Refund — số tiền thật nên `formatMoneyExact`, như mọi chỗ in tiền hoàn. */
function refundDetail(refund: RefundSummary, currency: string): string {
  const t = messages.bookingDetail.journey;
  if (refund.kind === 'full') return formatMoneyExact(refund.amount, currency);
  if (refund.kind === 'partial') {
    return t.refundPartial(
      formatMoneyExact(refund.amount, currency),
      formatMoneyExact(refund.total, currency),
    );
  }
  return t.refundNone;
}

function lapsedJourney(booking: BookingDetail): JourneyView {
  const t = messages.bookingDetail.journey;
  return {
    variant: 'lapsed',
    milestones: [
      {
        key: 'booked',
        label: messages.bookingDetail.booked,
        detail: formatDate(isoDay(booking.createdAt)),
        state: 'done',
      },
      { key: 'paymentNotCompleted', label: t.paymentNotCompleted, detail: null, state: 'done' },
    ],
    today: null,
    fillPercent: 100,
    chip: null,
  };
}
