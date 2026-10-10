import { canAuthorEdit } from '@tourism/contract';

export type MyReviewModerationState = 'approved' | 'pending' | 'rejected' | 'retracted';

/** Việc khách làm tiếp được với một review (mockup R4): đã đăng → rút (R7);
 * bị bác còn lượt → sửa (R5); bị bác hết lượt → giải thích (R6); còn lại → không có nút. */
export type MyReviewNextStep = 'retract' | 'rewrite' | 'exhausted' | 'none';

export function myReviewNextStep(review: {
  moderationState: MyReviewModerationState;
  rejectionCount: number;
}): MyReviewNextStep {
  if (review.moderationState === 'approved') return 'retract';
  if (review.moderationState === 'rejected') {
    return canAuthorEdit(review) ? 'rewrite' : 'exhausted';
  }
  return 'none';
}

/** Tông nền pill theo trạng thái (ADR-0031 §6: không suy từ `isApproved`). */
export function myReviewTone(
  state: MyReviewModerationState,
): 'success' | 'warning' | 'destructive' | 'muted' {
  if (state === 'approved') return 'success';
  if (state === 'pending') return 'warning';
  if (state === 'rejected') return 'destructive';
  return 'muted';
}

/**
 * Tham số `reviews.mine` cho mọi màn cụm review. Tên khoá PHẢI khớp `PageQuerySchema`
 * (`pageSize`, không phải `limit`): Zod bỏ khoá lạ nên `limit` trước đây không có
 * tác dụng, server trả mặc định 20 bài và bài cũ hơn không sửa/rút được từ app.
 */
export const MY_REVIEWS_INPUT = { page: 1, pageSize: 100 } as const;
