import type { BookingStatusValue } from '@tourism/contract';

/**
 * Logic thuần của tab Trips (T1-T3, mockup P5b-3). Chip lọc Upcoming/Past lọc
 * Ở MÁY theo ngày khởi hành — `BookingsListQuerySchema` chưa có tham số đó
 * (mockup T1 caption), nên đây KHÔNG phải luật tiền/hạn chót (ADR-0041) mà chỉ
 * là gom nhóm hiển thị; nhận `today` qua tham số thay vì tự đọc đồng hồ máy để
 * hàm test được xác định.
 */
export type TripWindow = 'all' | 'upcoming' | 'past';

/** Booking đã huỷ/hoàn không còn là chuyến sắp tới. */
const INACTIVE_STATUSES = new Set(['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']);

/**
 * "Upcoming" = chưa kết thúc, gồm cả chuyến đang đi (ngày đi đã qua mà ngày về
 * chưa tới), và loại booking đã huỷ/hoàn. Thiếu `departureEndDate` thì coi như
 * một ngày.
 */
export function filterTripsByWindow<
  T extends { departureStartDate: string; departureEndDate?: string; status?: string },
>(items: readonly T[], window: TripWindow, today: string): T[] {
  if (window === 'all') return [...items];
  const endOf = (item: T) => item.departureEndDate ?? item.departureStartDate;
  const active = items.filter((item) => !INACTIVE_STATUSES.has(item.status ?? ''));
  if (window === 'upcoming') return active.filter((item) => endOf(item) >= today);
  // Past = chuyến đã đi. Booking đã huỷ/hoàn chưa từng đi nên không vào đây.
  return active.filter((item) => endOf(item) < today);
}

/** Ba tông nền pill trạng thái (mockup `.pill-status.paid/.pending/.off`). */
export type TripPillTone = 'paid' | 'pending' | 'muted';

export function tripPillTone(status: BookingStatusValue): TripPillTone {
  if (status === 'PAID') return 'paid';
  if (status === 'PENDING') return 'pending';
  return 'muted';
}
