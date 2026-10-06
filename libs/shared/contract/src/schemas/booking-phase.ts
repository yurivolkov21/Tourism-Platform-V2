import { z } from 'zod';
import type { BookingStatusValue } from './bookings.js';
import { tripLengthDays } from './refund-policy.js';

/**
 * Giai đoạn của MỘT đơn của khách (ADR-0054 §1) — SUY từ trạng thái đơn và hai ngày của
 * chuyến, không lưu ở đâu cả. Một luật cho API (lọc, xếp, đếm của `bookings.mine`) và cho
 * ba trang đơn của web. Trước ADR-0054 luật này rải ở sáu chỗ trên web, và
 * `groupBookingsByTime` xếp đơn REFUNDED còn ngày đi tương lai vào nhóm "sắp đi".
 *
 * Viết thường, nối gạch dưới — giá trị SUY RA, không phải enum của DB (viết hoa).
 */
export const BookingPhaseSchema = z.enum([
  'awaiting_payment',
  'upcoming',
  'on_tour',
  'travelled',
  'cancelled',
  'lapsed',
]);
export type BookingPhase = z.output<typeof BookingPhaseSchema>;

/**
 * Ba nhóm của bộ lọc "When" (ADR-0054 §2). Viết HOA vì giá trị đi trên query của
 * `bookings.mine` (`when[0]=UPCOMING`), cùng nếp với các enum khác của contract.
 */
export const BookingWhenSchema = z.enum(['ON_TOUR', 'UPCOMING', 'PAST']);
export type BookingWhen = z.output<typeof BookingWhenSchema>;

/**
 * PAID và PARTIALLY_REFUNDED: đơn còn hiệu lực, chuyến vẫn đi — đúng hai trạng thái
 * `isCancellableStatus` của API nhận (`apps/api/src/modules/bookings/booking-cancellation.ts`).
 */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatusValue[] = [
  'PAID',
  'PARTIALLY_REFUNDED',
];

/** Phần của một đơn mà luật giai đoạn cần — `Booking` của contract khớp sẵn kiểu này. */
export interface BookingPhaseInput {
  status: BookingStatusValue;
  /** Ngày lịch `YYYY-MM-DD` (snapshot lúc đặt). */
  departureStartDate: string;
  /** Ngày lịch `YYYY-MM-DD` (snapshot lúc đặt). */
  departureEndDate: string;
}

/**
 * Giai đoạn của đơn vào ngày `today` — ngày lịch Việt Nam do SERVER tính (`vietnamToday` ở
 * API, `todayDateString` ở web). Không bao giờ so bằng đồng hồ trình duyệt.
 *
 * So CHUỖI `YYYY-MM-DD`: thứ tự từ điển trùng thứ tự thời gian. Biên đóng hai đầu: ngày đi và
 * ngày về đều là `on_tour`. PENDING tới ngày đi là `lapsed` vì chuyến đã hết nhận đặt — hạn
 * chót luôn trước ngày đi (ADR-0041 §3).
 */
export function bookingPhase(booking: BookingPhaseInput, today: string): BookingPhase {
  const { status, departureStartDate, departureEndDate } = booking;
  switch (status) {
    case 'CANCELLED':
    case 'REFUNDED':
      return 'cancelled';
    case 'PENDING':
      return departureStartDate > today ? 'awaiting_payment' : 'lapsed';
    case 'PAID':
    case 'PARTIALLY_REFUNDED':
      if (departureEndDate < today) return 'travelled';
      return departureStartDate <= today ? 'on_tour' : 'upcoming';
  }
}

/** Giai đoạn → nhóm của bộ lọc "When". Đơn chờ trả vẫn là "sắp đi": khách còn trả được. */
export function bookingWhen(phase: BookingPhase): BookingWhen {
  switch (phase) {
    case 'on_tour':
      return 'ON_TOUR';
    case 'upcoming':
    case 'awaiting_payment':
      return 'UPCOMING';
    case 'travelled':
    case 'cancelled':
    case 'lapsed':
      return 'PAST';
  }
}

/**
 * Số ngày lịch từ `from` tới `to` (to − from), cả hai `YYYY-MM-DD`; âm khi `to` trước `from`.
 *
 * Dựng trên `tripLengthDays` của luật huỷ (đếm CẢ HAI đầu, chỉ nhận đầu ≤ cuối) thay vì chép
 * lại phép đổi ngày: trừ 1 ra khoảng cách, đảo hai đầu cho chiều âm. Ngày hỏng ném
 * `RangeError` từ chính hàm ấy — một cột ngày lỗi thành 500 nhìn thấy được, không thành NaN.
 */
export function calendarDaysBetween(from: string, to: string): number {
  return from <= to ? tripLengthDays(from, to) - 1 : 1 - tripLengthDays(to, from);
}

/** Ba con số của mục 2.3 spec P7 — đếm ngược, ngày trong chuyến, độ dài chuyến. */
export interface TripDayNumbers {
  daysToGo: number;
  dayOfTrip: number;
  tripLength: number;
}

/** daysToGo = start − today; dayOfTrip = today − start + 1; tripLength = end − start + 1. */
export function tripDayNumbers(
  dates: { departureStartDate: string; departureEndDate: string },
  today: string,
): TripDayNumbers {
  return {
    daysToGo: calendarDaysBetween(today, dates.departureStartDate),
    dayOfTrip: calendarDaysBetween(dates.departureStartDate, today) + 1,
    tripLength: tripLengthDays(dates.departureStartDate, dates.departureEndDate),
  };
}
