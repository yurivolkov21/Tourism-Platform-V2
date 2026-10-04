/**
 * Logic thuần của form viết đánh giá (R1, mockup `mobile-review-screens` mục 1).
 * Chỉ hai luật chặn ở máy: có sao và body đủ sàn. Trần 2000 và các luật còn
 * lại để server nói (contract `CreateReviewInputSchema`).
 */
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 2000;
export const REVIEW_TITLE_MAX = 120;

export interface ReviewDraft {
  rating: number | null;
  title: string;
  body: string;
}

export function canSubmitReview(draft: ReviewDraft): boolean {
  return draft.rating !== null && draft.body.trim().length >= REVIEW_BODY_MIN;
}

/** Dựng input `reviews.create`: cắt khoảng trắng, title rỗng thì bỏ hẳn. */
export function buildReviewInput(bookingCode: string, draft: ReviewDraft) {
  if (draft.rating === null) throw new Error('rating required');
  const title = draft.title.trim();
  return {
    bookingCode,
    rating: draft.rating,
    body: draft.body.trim(),
    ...(title === '' ? {} : { title }),
  };
}
