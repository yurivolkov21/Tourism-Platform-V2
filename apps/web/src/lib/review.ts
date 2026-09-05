import { type BookingDetail, canAuthorEdit, isEditLimitReached } from '@tourism/contract';

/**
 * Chỗ đánh giá trên trang chi tiết booking hiện gì.
 *
 * - `form`          — chưa viết, đủ điều kiện: hiện form.
 * - `pending`       — đã gửi, đang chờ duyệt; còn sửa được.
 * - `rejected`      — bị bác, còn lượt viết lại: hiện LÝ DO + form sửa.
 * - `rejectedFinal` — bị bác và hết lượt: hiện lý do + lối liên hệ.
 * - `approved`      — đã lên site, hiện lời cảm ơn.
 * - `tooEarly`      — đã trả tiền nhưng chuyến chưa xong; nói rõ "chưa tới
 *                     lúc" thay vì ẩn hẳn, không thì khách tưởng site không có
 *                     tính năng đánh giá.
 * - `hidden`        — không có gì để nói ở đây (chưa trả tiền, đã huỷ, đã hoàn).
 *
 * ## Vì sao đọc `booking.review` chứ không `booking.reviewedAt`
 *
 * `reviewedAt` là một MỐC THỜI GIAN, không mang phán quyết nào. Trước ADR-0032
 * hàm này chỉ có nó, nên mọi review đã gửi đều rơi vào một nhánh `done` duy
 * nhất — và khách bị bác quay lại đúng trang họ từng viết, đọc thấy *"bạn đã
 * đánh giá chuyến này rồi"* kèm một lời cảm ơn. Email nói thật, sản phẩm thì
 * im.
 *
 * ## Vì sao luật "còn sửa được không" KHÔNG nằm ở đây
 *
 * `canAuthorEdit` là hàm của contract, và API dùng ĐÚNG hàm ấy làm cổng
 * (ADR-0032 §6). Bài học đã trả giá ngay trong chính file này: nhánh
 * PAID/chưa-xong-chuyến bên dưới là bản CHÉP TAY của `checkReviewEligibility`
 * phía API, và JSDoc cũ phải tự dặn "web nói khác API thì khách gõ hết bài rồi
 * mới bị từ chối". Phần mới không chép nữa.
 *
 * Biên đóng: chuyến kết thúc ĐÚNG hôm nay là đã xong (API chặn khi
 * `end > now`, không phải `end >= now`).
 */
export type ReviewSlot =
  | 'form'
  | 'pending'
  | 'rejected'
  | 'rejectedFinal'
  | 'approved'
  | 'tooEarly'
  | 'hidden';

export function reviewSlot(booking: BookingDetail): ReviewSlot {
  const review = booking.review;
  if (review) {
    if (review.moderationState === 'approved') return 'approved';
    if (isEditLimitReached(review)) return 'rejectedFinal';
    // Còn sửa được: `pending` và `rejected` cần hai câu khác nhau, nên tách
    // nhánh chứ không gộp thành một "editable".
    if (!canAuthorEdit(review)) return 'rejectedFinal';
    return review.moderationState === 'rejected' ? 'rejected' : 'pending';
  }
  if (booking.status !== 'PAID') return 'hidden';
  const today = new Date().toISOString().slice(0, 10);
  return booking.departureEndDate > today ? 'tooEarly' : 'form';
}
