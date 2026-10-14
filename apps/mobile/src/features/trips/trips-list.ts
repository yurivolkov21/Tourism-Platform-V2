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
 * Pill trạng thái của MỘT đơn — chung cho thẻ Trips và hoá đơn `/bookings/[code]`. Chữ đọc bảng
 * `words` (`messages.mobile.trips.status`) theo trạng thái đơn, trừ chuyến CÔNG TY huỷ: cờ ấy
 * thắng mọi trạng thái đơn (ADR-0054 AMEND 1 §2), nên đơn còn PAID hay hoàn một phần chờ job hoàn
 * tiền không được mang "Paid" xanh. Nhãn nói "Cancelled"; đơn đã hoàn trọn giữ "Refunded" — sự
 * thật về tiền vẫn đúng. Cùng luật giai đoạn `cancelled` của `phaseLabel` bên web
 * (`apps/web/src/lib/booking-vm.ts`): mọi đơn khác rơi vào giai đoạn ấy (CANCELLED, REFUNDED có
 * mốc huỷ) vốn đã cho đúng chữ và tông xám theo trạng thái, nên ở đây không cần ngày hôm nay.
 */
export function bookingStatusPill(
  booking: Pick<Booking, 'status' | 'departureCancelled'>,
  words: Readonly<Record<string, string>>,
): TripPill {
  if (booking.departureCancelled) {
    const key = booking.status === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED';
    return { tone: 'muted', label: words[key] ?? key };
  }
  return { tone: tripPillTone(booking.status), label: words[booking.status] ?? booking.status };
}

/**
 * Pill của thẻ Trips theo giai đoạn: đang đi thì "On tour now" tô xanh như PAID — kể cả đơn đã
 * hoàn một phần, khách vẫn đi tour; còn lại là `bookingStatusPill`. Chuyến công ty huỷ không
 * bao giờ là `on_tour`: `bookingPhase` xét cờ ấy trước mọi thứ.
 */
export function tripCardPill(
  booking: Pick<Booking, 'status' | 'departureCancelled'>,
  phase: BookingPhase,
  words: { status: Readonly<Record<string, string>>; onTourNow: string },
): TripPill {
  if (phase === 'on_tour') return { tone: 'paid', label: words.onTourNow };
  return bookingStatusPill(booking, words.status);
}
