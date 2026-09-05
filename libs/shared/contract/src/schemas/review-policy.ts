import type { ReviewModerationState } from './reviews.js';

/**
 * Luật "tác giả còn sửa được review của mình không" — NGUỒN DUY NHẤT
 * (ADR-0032 §6).
 *
 * ## Vì sao ở CONTRACT chứ không ở mỗi bên một bản
 *
 * API dùng nó làm **cổng** (từ chối lệnh sửa không hợp lệ), web dùng nó để
 * quyết **hiện form hay hiện câu "hết đường"**. Hai bên chép tay cùng một luật
 * là hai bên sẽ trôi lệch, và cái giá thì đã trả một lần rồi: `reviewSlot()`
 * bên web chép tay luật của `checkReviewEligibility` phía API, và JSDoc của
 * chính nó phải tự dặn —
 *
 * > *"Nếu web nói khác API thì khách sẽ thấy 'chưa tới lúc', trả tiền xong lại
 * > thấy chỗ đó biến mất — hoặc tệ hơn, gõ hết bài rồi mới bị từ chối."*
 *
 * Lần này không chép nữa.
 */

/**
 * Số lần BỊ BÁC tối đa trước khi đường sửa đóng lại (ADR-0032 §5).
 *
 * Không có trần thì vòng bác → sửa → vào hàng đợi → bác lặp vô hạn, và mỗi
 * vòng tốn một lượt đọc của người thật. Vòng ấy vốn đã hẹp (một review mỗi
 * booking, mà booking thì phải trả tiền), nhưng hẹp không phải là đóng.
 *
 * Đếm theo số lần **BỊ BÁC**, không theo số lần SỬA: một khách sửa ba lần rồi
 * được duyệt là một câu chuyện tốt, thứ tốn công người thật là số lần bác.
 *
 * Con số 2 là lựa chọn biên tập, và nó nói được thành câu cho khách nghe:
 * *"chúng tôi đã xem lại hai lần"*. Một lần thì quá gắt với một hiểu lầm; ba
 * lần thì đã là kiên nhẫn giả vờ.
 */
export const REVIEW_REJECTION_LIMIT = 2;

/** Mọi thứ cần để biết một review còn sửa được không. */
export interface ReviewEditContext {
  moderationState: ReviewModerationState;
  /** Số sự kiện moderation `to_rejected = true` của chính review ấy. */
  rejectionCount: number;
}

/**
 * Tác giả còn sửa được review này không.
 *
 * `approved` KHÔNG sửa được, và đó là ranh giới an toàn chứ không phải tiện
 * tay (ADR-0032 §2): cho sửa nội dung ĐANG hiển thị công khai là mở đường tráo
 * một bài tử tế đã duyệt thành spam, sau lưng kiểm duyệt.
 *
 * `pending` sửa được dù chưa ai bác: chưa đăng, chưa quyết, nên sửa là vô hại
 * — và nó chữa lỗi gõ trước khi người duyệt đọc thay vì bắt khách chờ bị bác.
 */
export function canAuthorEdit(review: ReviewEditContext): boolean {
  if (review.moderationState === 'approved') return false;
  return review.rejectionCount < REVIEW_REJECTION_LIMIT;
}

/**
 * Đã hết lượt sửa vì bị bác đủ số lần — KHÁC với "không sửa được vì đã duyệt".
 *
 * Tách riêng vì hai ca cần hai câu khác hẳn nhau với khách: một bên là *"bài
 * của bạn đang hiển thị rồi"*, bên kia là *"chúng tôi đã xem lại hai lần"*.
 * Gộp chúng thành một `canAuthorEdit === false` là buộc mỗi nơi hiển thị tự
 * suy lại lý do, và suy sai thì khách đọc một câu vô nghĩa.
 */
export function isEditLimitReached(review: ReviewEditContext): boolean {
  return review.moderationState !== 'approved' && review.rejectionCount >= REVIEW_REJECTION_LIMIT;
}
