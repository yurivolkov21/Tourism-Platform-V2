import type { BookingPhase, BookingStatusValue } from '@tourism/contract';

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
