import type { BookingCancellation } from '@tourism/contract';
import {
  canCancelOnline,
  cancellationDeadline,
  isWithinDeadline,
  refundOnCancel,
} from '@tourism/contract';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';

/**
 * Luật huỷ của MỘT booking ở tầng API (ADR-0041 §4) — hàm thuần, không đọc DB.
 * Hai nơi dùng chung để con số khách THẤY là con số server HOÀN:
 * `bookings.byCode` (trường `cancellation`) và lõi huỷ trong
 * `CancellationsService` (chặn trước khi gọi cổng thanh toán).
 *
 * Ngày chuyến đọc từ SNAPSHOT của booking (`departure_start_date`,
 * `departure_end_date`), không join sống chuyến: sửa chuyến sau khi đặt không
 * đổi hạn chót đã hứa với khách.
 */

/** Phần booking mà luật huỷ cần — cắt đúng chừng này để test dựng bằng object thuần. */
export interface CancellableBooking {
  status: BookingStatus;
  departureStartDate: Date;
  departureEndDate: Date;
  totalAmount: Prisma.Decimal;
  providerPaymentId: string | null;
}

/** PAID hoặc PARTIALLY_REFUNDED — hai trạng thái luật huỷ áp dụng; REFUNDED thì khách liên hệ. */
export function isCancellableStatus(status: BookingStatus): boolean {
  return status === BookingStatus.PAID || status === BookingStatus.PARTIALLY_REFUNDED;
}

/**
 * Lý do booking KHÔNG huỷ online được lúc `now`, hoặc `null` khi huỷ được. Chuỗi
 * trả về là chi tiết cho log và thông điệp lỗi 422, không phải copy cho khách
 * (web in câu của `@tourism/i18n`).
 */
export function cancellationBlocker(booking: CancellableBooking, now: Date): string | null {
  if (!isCancellableStatus(booking.status)) {
    return `booking is ${booking.status}; only a PAID or PARTIALLY_REFUNDED booking can be cancelled online`;
  }
  if (booking.providerPaymentId === null) {
    return 'booking has no captured payment to refund against';
  }
  if (!canCancelOnline(now, calendarDate(booking.departureStartDate))) {
    return 'the departure date has been reached (Vietnam time)';
  }
  return null;
}

/**
 * Số tiền hoàn nếu huỷ lúc `now`, dạng `'117.00'`: trong hạn là phần còn lại của
 * sổ, quá hạn là `'0.00'`. `refundedTotal` là SUM(refunds); `null` = chưa hoàn
 * đồng nào. Không kiểm `cancellationBlocker` — người gọi tự quyết thứ tự.
 */
export function refundOnCancelForBooking(
  booking: CancellableBooking,
  refundedTotal: Prisma.Decimal | null,
  now: Date,
): string {
  return refundOnCancel({
    now,
    startDate: calendarDate(booking.departureStartDate),
    endDate: calendarDate(booking.departureEndDate),
    totalAmount: booking.totalAmount.toFixed(2),
    refundedTotal: (refundedTotal ?? new Prisma.Decimal(0)).toFixed(2),
  });
}

/**
 * Trường `bookings.byCode.cancellation` (plan 15/09 Hợp đồng B): `null` khi
 * trạng thái ngoài PAID/PARTIALLY_REFUNDED.
 */
export function bookingCancellation(
  booking: CancellableBooking,
  refundedTotal: Prisma.Decimal | null,
  now: Date,
): BookingCancellation | null {
  if (!isCancellableStatus(booking.status)) return null;
  const startDate = calendarDate(booking.departureStartDate);
  const endDate = calendarDate(booking.departureEndDate);
  return {
    deadline: cancellationDeadline(startDate, endDate),
    withinDeadline: isWithinDeadline(now, startDate, endDate),
    refundAmount: refundOnCancelForBooking(booking, refundedTotal, now),
    canCancel: cancellationBlocker(booking, now) === null,
  };
}
