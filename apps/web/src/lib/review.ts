import type { Booking } from '@tourism/contract';

/**
 * Chỗ đánh giá trên trang chi tiết booking hiện gì.
 *
 * - `done`     — đã viết rồi, hiện lời cảm ơn thay vì form.
 * - `form`     — đủ điều kiện, hiện form.
 * - `tooEarly` — đã trả tiền nhưng chuyến chưa xong; nói rõ "chưa tới lúc"
 *                thay vì ẩn hẳn, không thì khách tưởng site không có tính
 *                năng đánh giá.
 * - `hidden`   — không có gì để nói ở đây (chưa trả tiền, đã huỷ, đã hoàn).
 *
 * Luật SOI GƯƠNG `checkReviewEligibility` phía API, kể cả THỨ TỰ ưu tiên:
 * trạng thái PAID kiểm trước ngày kết thúc. Nếu web nói khác API thì khách sẽ
 * thấy "chưa tới lúc", trả tiền xong lại thấy chỗ đó biến mất — hoặc tệ hơn,
 * gõ hết bài rồi mới bị từ chối.
 *
 * Biên đóng: chuyến kết thúc ĐÚNG hôm nay là đã xong (API chặn khi
 * `end > now`, không phải `end >= now`).
 */
export type ReviewSlot = 'done' | 'form' | 'tooEarly' | 'hidden';

export function reviewSlot(booking: Booking): ReviewSlot {
  if (booking.reviewedAt !== null) return 'done';
  if (booking.status !== 'PAID') return 'hidden';
  const today = new Date().toISOString().slice(0, 10);
  return booking.departureEndDate > today ? 'tooEarly' : 'form';
}
