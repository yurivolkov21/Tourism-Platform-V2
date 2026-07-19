import { BookingStatus } from '../../generated/prisma/enums.js';

export type EligibilityInput = {
  bookingStatus: BookingStatus;
  departureEndDate: Date;
  now: Date;
  ownerId: string;
  callerId: string;
};

export type EligibilityResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_OWNER' | 'NOT_PAID' | 'TRIP_NOT_COMPLETED' };

/** So sánh theo NGÀY LỊCH (UTC), không theo thời điểm — chuyến kết thúc hôm
 * nay thì tối nay review được, không phải chờ qua nửa đêm. */
function calendarDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Quyết định một booking có được viết review không.
 *
 * Nâng cấp so với Nexora (audit A7): Nexora chỉ đòi `status === PAID`, tức
 * khách trả tiền hôm nay cho tour khởi hành 3 tháng nữa vẫn review được ngay
 * — vô nghĩa với người đọc. Ở đây đòi chuyến đã kết thúc.
 *
 * Thứ tự kiểm là CỐ Ý: quyền sở hữu trước trạng thái, để caller không phải
 * chủ booking không suy ra được trạng thái booking của người khác.
 */
export function checkReviewEligibility(input: EligibilityInput): EligibilityResult {
  if (input.callerId !== input.ownerId) return { ok: false, reason: 'NOT_OWNER' };
  if (input.bookingStatus !== BookingStatus.PAID) return { ok: false, reason: 'NOT_PAID' };
  if (calendarDay(input.departureEndDate) > calendarDay(input.now)) {
    return { ok: false, reason: 'TRIP_NOT_COMPLETED' };
  }
  return { ok: true };
}
