import { BookingStatus } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';

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

/**
 * So sánh theo NGÀY LỊCH **UTC** — có chủ đích, KHÔNG đổi sang giờ VN.
 *
 * `departureEndDate` là cột Prisma `@db.Date` nên luôn được lưu/đọc dưới dạng
 * UTC-midnight của ngày kết thúc (vd. chuyến kết thúc 19/07 → giá trị chính
 * xác là `2026-07-19T00:00:00Z`). `now` là một thời điểm thật.
 *
 * Hệ quả ĐÃ CÂN NHẮC và CHẤP NHẬN: trong khung 00:00–07:00 giờ VN (UTC+7) của
 * đúng ngày tour kết thúc, `calendarDay(now)` vẫn là ngày HÔM TRƯỚC theo UTC
 * (vd. 3h sáng 19/07 giờ VN = 20:00 18/07 UTC), nên hàm coi chuyến CHƯA kết
 * thúc và từ chối review — điều này ĐÚNG về nghĩa: lúc 3h sáng của ngày tour
 * kết thúc thì tour thật sự chưa xong, cho review lúc này là cho review một
 * chuyến còn đang diễn ra. Từ 07:00 giờ VN cùng ngày trở đi (= 00:00 UTC ngày
 * đó), `calendarDay(now)` bắt kịp `calendarDay(departureEndDate)` và review
 * được cho phép ngay, không cần chờ qua nửa đêm giờ VN.
 */
/** Một tên gọi cho ngày UTC — máy thật là `calendarDate` dùng chung của API. */
const calendarDay = calendarDate;

/**
 * Quyết định một booking có được viết review không.
 *
 * Nâng cấp so với Nexora (audit A7): Nexora chỉ đòi `status === PAID`, tức
 * khách trả tiền hôm nay cho tour khởi hành 3 tháng nữa vẫn review được ngay
 * — vô nghĩa với người đọc. Ở đây đòi chuyến đã kết thúc.
 *
 * Thứ tự kiểm là CỐ Ý: quyền sở hữu trước trạng thái, để caller không phải
 * chủ booking không suy ra được trạng thái booking của người khác. Trạng thái
 * PAID được kiểm trước ngày kết thúc chuyến (NOT_PAID thắng TRIP_NOT_COMPLETED).
 *
 * Giả định múi giờ: xem JSDoc của `calendarDay()` — so sánh theo ngày UTC có
 * chủ đích, không theo giờ VN.
 */
export function checkReviewEligibility(input: EligibilityInput): EligibilityResult {
  if (input.callerId !== input.ownerId) return { ok: false, reason: 'NOT_OWNER' };
  if (input.bookingStatus !== BookingStatus.PAID) return { ok: false, reason: 'NOT_PAID' };
  if (calendarDay(input.departureEndDate) > calendarDay(input.now)) {
    return { ok: false, reason: 'TRIP_NOT_COMPLETED' };
  }
  return { ok: true };
}
