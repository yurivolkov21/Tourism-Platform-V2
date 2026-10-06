import { vietnamToday } from '@tourism/contract';

/**
 * "Hôm nay" dạng `YYYY-MM-DD` theo NGÀY LỊCH VIỆT NAM (`vietnamToday` của
 * contract) — cùng thước với mọi cổng phía server (ADR-0041 §7): huỷ online
 * (`canCancelOnline`), chốt chặn đặt chỗ, và giai đoạn chuyến trên màn
 * Departures của admin (ADR-0046). Tới 23/09 hàm này cắt ngày theo UTC, nên từ
 * 00:00 tới 07:00 giờ VN trang account chậm một ngày: in "còn 1 ngày" cho
 * chuyến server đã thôi cho huỷ online, và chưa hiện Review cho chuyến admin
 * đã ghi Completed.
 *
 * Cùng format thuần ngày với `departureStartDate` (`z.iso.date()`, không
 * giờ/múi giờ) nên so sánh lexicographic (`>=`/`<`) là đủ đúng thứ tự thời
 * gian, khỏi parse `Date`.
 *
 * Export (fix cuối 11/08): `lib/passport.ts`, `BookingAccordion` (nhận qua
 * prop từ trang `/account/bookings`) và cuống của receipt tái dùng ĐÚNG helper
 * này thay vì tự parse `Date` — một luật "đã xong"/"đang đi" duy nhất.
 *
 * KHÔNG dùng để quyết form review mở hay chưa: `reviewSlot` cố ý giữ ngày UTC
 * để chép đúng `checkReviewEligibility` của API (ADR-0009 AMEND 3).
 */
export function todayDateString(): string {
  return vietnamToday(new Date());
}
