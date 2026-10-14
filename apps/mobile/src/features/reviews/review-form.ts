import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';

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

/** Những gì khách đã điền ở R1, R5 — để biết rời màn lúc này có làm mất gì không. */
export interface ReviewDraftSnapshot extends ReviewDraft {
  /** Khoá các ô ảnh theo thứ tự đang hiện; ô đang tải và ô tải lỗi cũng tính. */
  photoKeys: readonly string[];
}

/** Gốc so sánh của R1: form chưa điền gì. */
export const BLANK_REVIEW_DRAFT: ReviewDraftSnapshot = {
  rating: null,
  title: '',
  body: '',
  photoKeys: [],
};

/**
 * Bài đang viết có khác gốc không — khác thì rời màn là mất (open-items P5b-5 mục 4). Gốc của R1
 * là form trống; của R5 là bài cũ điền sẵn, nên mở R5 rồi rời ngay không mất gì. Chữ so sau khi
 * cắt khoảng trắng hai đầu, cùng cách `buildReviewInput` gửi đi: chỉ gõ dấu cách là chưa viết gì.
 */
export function reviewDraftChanged(
  current: ReviewDraftSnapshot,
  baseline: ReviewDraftSnapshot,
): boolean {
  return (
    current.rating !== baseline.rating ||
    current.title.trim() !== baseline.title.trim() ||
    current.body.trim() !== baseline.body.trim() ||
    current.photoKeys.length !== baseline.photoKeys.length ||
    current.photoKeys.some((key, index) => key !== baseline.photoKeys[index])
  );
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

/**
 * Câu lỗi khi gửi/sửa review: 429 → câu chờ; mã có trong bảng `messages.reviews.errors`
 * → câu riêng của mã đó; còn lại → câu chung. Trước đây R1 chỉ xử lý hai mã.
 */
export function reviewSubmitErrorMessage(error: unknown): string {
  if (error instanceof ORPCError) {
    if (error.status === 429) return messages.accountActionErrors.throttle;
    const known: Record<string, string | undefined> = messages.reviews.errors;
    const text = known[error.code];
    if (text !== undefined) return text;
  }
  return messages.accountActionErrors.generic;
}
