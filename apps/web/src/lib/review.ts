import { type BookingDetail, canAuthorEdit, isEditLimitReached } from '@tourism/contract';

/**
 * Chỗ đánh giá trên trang chi tiết booking hiện gì.
 *
 * - `form`          — chưa viết, đủ điều kiện: hiện form.
 * - `pending`       — đã gửi, đang chờ duyệt; còn sửa được.
 * - `rejected`      — bị bác, còn lượt viết lại: hiện LÝ DO + form sửa.
 * - `rejectedFinal` — bị bác và hết lượt: hiện lý do + lối liên hệ.
 * - `approved`      — đã lên site, hiện lời cảm ơn.
 * - `tooEarly`      — đã trả tiền nhưng chuyến chưa xong (cổng API chưa mở). Trang
 *                     chi tiết đơn KHÔNG dựng khu review cho slot này
 *                     (`hasReviewArea`): chân khối Get ready đã nói ngày mở, nên
 *                     khách không tưởng site thiếu tính năng đánh giá.
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
 *
 * "Hôm nay" ở nhánh đó là ngày lịch UTC, CỐ Ý khác `todayDateString` (ngày
 * Việt Nam) của trang account: đây là bản chép cổng `checkReviewEligibility`,
 * mà cổng ấy giữ UTC (ADR-0009 AMEND 3). Đổi riêng web sang ngày VN là mở form
 * từ 00:00 giờ VN của ngày về, trong khi API tới 07:00 mới nhận.
 */
export type ReviewSlot =
  | 'form'
  | 'pending'
  | 'rejected'
  | 'rejectedFinal'
  | 'approved'
  | 'retracted'
  | 'tooEarly'
  | 'hidden';

export function reviewSlot(booking: BookingDetail): ReviewSlot {
  const review = booking.review;
  if (review) {
    // W4 U2 (ADR-0032 AMEND 1): tác giả đã RÚT — kết cục đóng, đứng TRƯỚC
    // mọi nhánh khác (canAuthorEdit cũng trả false cho trạng thái này, nhưng
    // câu cho khách phải là "bạn đã rút" chứ không phải "hết lượt sửa").
    if (review.moderationState === 'retracted') return 'retracted';
    if (review.moderationState === 'approved') return 'approved';
    if (isEditLimitReached(review)) return 'rejectedFinal';
    // Còn sửa được: `pending` và `rejected` cần hai câu khác nhau, nên tách
    // nhánh chứ không gộp thành một "editable".
    if (!canAuthorEdit(review)) return 'rejectedFinal';
    return review.moderationState === 'rejected' ? 'rejected' : 'pending';
  }
  if (booking.status !== 'PAID') return 'hidden';
  // Ngày UTC, cố ý — xem JSDoc của `ReviewSlot`.
  const today = new Date().toISOString().slice(0, 10);
  return booking.departureEndDate > today ? 'tooEarly' : 'form';
}

/**
 * Slot có khu review để vẽ — mọi giá trị của `reviewSlot` trừ hai tín hiệu "không vẽ gì":
 * `hidden` và `tooEarly`.
 */
export type ReviewAreaSlot = Exclude<ReviewSlot, 'hidden' | 'tooEarly'>;

/**
 * Trang chi tiết đơn có khu review không — theo CỔNG của API (`reviewSlot`), không theo giai
 * đoạn (ADR-0054 AMEND 1 §5), ở MỌI giai đoạn.
 *
 * Bản trước chỉ dựng khu review ở `travelled` (ngày VN) trong khi cổng mở từ 07:00 giờ VN của
 * chính ngày về: ~17 giờ mỗi chuyến không có form (review P7 B6). Và đơn đã có review rồi bị hoàn
 * hay huỷ mất luôn đường sửa, rút — API vẫn cho cả hai (B2). Đây cũng là luật của trang cũ
 * (`slot !== 'hidden'`), trừ `tooEarly`: câu "chưa tới lúc" nay do chân khối Get ready nói.
 */
export function hasReviewArea(slot: ReviewSlot): slot is ReviewAreaSlot {
  return slot !== 'hidden' && slot !== 'tooEarly';
}
