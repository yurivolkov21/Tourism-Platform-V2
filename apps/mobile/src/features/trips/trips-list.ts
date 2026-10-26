import type { Booking, BookingPhase, BookingStatusValue } from '@tourism/contract';

/**
 * Logic thuần của tab Trips (T1-T3, mockup P5b-3). Chip Upcoming/Past lọc Ở MÁY theo GIAI
 * ĐOẠN của đơn — `bookingPhase` của contract (ADR-0054 AMEND 1), cùng hàm API và ba trang
 * đơn của web dùng để biết đơn nào sắp đi, đang đi, đã đi hay còn trả được. Cách gom chip
 * vẫn theo mockup T1 (Past chỉ gồm chuyến đã đi), khác bộ lọc "When" của web. Route tính
 * giai đoạn bằng ngày theo đồng hồ server rồi truyền vào; hàm ở đây không đọc đồng hồ.
 */
export type TripWindow = 'all' | 'upcoming' | 'past';

/**
 * "Upcoming" = còn trả được hoặc còn đi: chờ trả (chưa quá hạn chót), sắp đi, đang đi.
 * "Past" = chuyến ĐÃ đi. Đơn đã huỷ, chuyến bị công ty huỷ và đơn chờ trả quá hạn chót
 * (`lapsed`) chưa từng đi nên không vào nhóm nào, chỉ hiện ở "All".
 */
export function filterTripsByWindow<T extends { phase: BookingPhase }>(
  items: readonly T[],
  window: TripWindow,
): T[] {
  if (window === 'all') return [...items];
  if (window === 'upcoming') {
    return items.filter(
      (item) =>
        item.phase === 'awaiting_payment' || item.phase === 'upcoming' || item.phase === 'on_tour',
    );
  }
  return items.filter((item) => item.phase === 'travelled');
}

/**
 * Đơn còn đi theo ngày → cụm P (luật vào màn, handoff mục 3); còn lại → hoá đơn. Gồm PAID,
 * PARTIALLY_REFUNDED và REFUNDED hoàn thiện chí (không `cancelledAt`) — cả ba khách vẫn đi —
 * trừ chuyến đã bị công ty huỷ (`bookingPhase` xếp nó vào `cancelled` ngay cả khi job hoàn
 * tiền chưa chạy và đơn còn PAID).
 */
export function isTravellingPhase(phase: BookingPhase): boolean {
  return phase === 'upcoming' || phase === 'on_tour' || phase === 'travelled';
}

/** Ba tông nền pill trạng thái (mockup `.pill-status.paid/.pending/.off`). */
export type TripPillTone = 'paid' | 'pending' | 'muted';

export function tripPillTone(status: BookingStatusValue): TripPillTone {
  if (status === 'PAID') return 'paid';
  if (status === 'PENDING') return 'pending';
  return 'muted';
}

/** Chữ và tông của MỘT pill trạng thái. */
export interface TripPill {
  tone: TripPillTone;
  label: string;
}

/**
 * Chữ của pill trạng thái: bảng theo trạng thái đơn (`messages.mobile.trips.status`) và chữ riêng
 * của giai đoạn `lapsed`.
 */
export interface TripPillWords {
  status: Readonly<Record<string, string>>;
  lapsed: string;
}

/**
 * Pill trạng thái của MỘT đơn — chung cho thẻ Trips và hoá đơn `/bookings/[code]`. Chữ đọc bảng
 * `words.status` theo trạng thái đơn, trừ hai giai đoạn mà trạng thái đơn nói sai — cùng luật
 * `phaseLabel` bên web (`apps/web/src/lib/booking-vm.ts`):
 *
 * - `lapsed` (G54): PENDING qua hạn chót. "Payment due" cam là mời trả một khoản API không mở lại
 *   được, mà "đã lỡ" thì chưa chắc: claim của webhook còn nhận phiên mở trước hạn (ADR-0054
 *   AMEND 1 §4). Chữ trung tính `words.lapsed`, tông xám.
 * - Chuyến CÔNG TY huỷ: cờ ấy thắng mọi trạng thái đơn (AMEND 1 §2), nên đơn còn PAID hay hoàn
 *   một phần chờ job hoàn tiền không được mang "Paid" xanh. Nhãn nói "Cancelled"; đơn đã hoàn trọn
 *   giữ "Refunded" — sự thật về tiền vẫn đúng. Mọi đơn khác của giai đoạn `cancelled` (CANCELLED,
 *   REFUNDED có mốc huỷ) vốn đã cho đúng chữ và tông xám theo trạng thái.
 */
export function bookingStatusPill(
  booking: Pick<Booking, 'status' | 'departureCancelled'>,
  phase: BookingPhase,
  words: TripPillWords,
): TripPill {
  if (phase === 'lapsed') return { tone: 'muted', label: words.lapsed };
  if (booking.departureCancelled) {
    const key = booking.status === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED';
    return { tone: 'muted', label: words.status[key] ?? key };
  }
  return {
    tone: tripPillTone(booking.status),
    label: words.status[booking.status] ?? booking.status,
  };
}

/**
 * Pill của thẻ Trips theo giai đoạn: đang đi thì "On tour now" tô xanh như PAID — kể cả đơn đã
 * hoàn một phần, khách vẫn đi tour; còn lại là `bookingStatusPill`. Chuyến công ty huỷ không
 * bao giờ là `on_tour`: `bookingPhase` xét cờ ấy trước mọi thứ.
 */
export function tripCardPill(
  booking: Pick<Booking, 'status' | 'departureCancelled'>,
  phase: BookingPhase,
  words: TripPillWords & { onTourNow: string },
): TripPill {
  if (phase === 'on_tour') return { tone: 'paid', label: words.onTourNow };
  return bookingStatusPill(booking, phase, words);
}

/**
 * Đơn lên thẻ "Next trip" (B5): đơn có giai đoạn `upcoming` hoặc `on_tour` và ngày đi sớm
 * nhất. Hai đơn trùng ngày thì giữ đơn đứng trước trong danh sách. Không có đơn hợp lệ
 * thì `null` — màn ẩn thẻ.
 */
export function pickNextTrip<T extends { phase: BookingPhase; startDate: string }>(
  items: readonly T[],
): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (item.phase !== 'upcoming' && item.phase !== 'on_tour') continue;
    if (best === null || item.startDate < best.startDate) best = item;
  }
  return best;
}
