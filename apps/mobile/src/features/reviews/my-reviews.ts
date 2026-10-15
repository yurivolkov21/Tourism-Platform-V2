import {
  type Booking,
  type BookingsListQuery,
  canAuthorEdit,
  type MyReview,
} from '@tourism/contract';
import { canWriteReview } from '@/features/booking/booking-detail';

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

/**
 * Tham số `bookings.mine` cho khối "chờ viết bài" đầu R4 (card "Thêm khối", 15/10): server lọc
 * sẵn đơn PAID đang đi hoặc đã qua theo giờ Việt Nam. Có `ON_TOUR` vì cổng review mở từ ngày về
 * theo ngày UTC (`canWriteReview`), mà theo giờ Việt Nam ngày về vẫn là "đang đi". 50 là trần
 * `limit` của contract.
 */
export const AWAITING_REVIEW_BOOKINGS_INPUT: BookingsListQuery = {
  page: 1,
  limit: 50,
  status: 'PAID',
  when: ['ON_TOUR', 'PAST'],
  order: 'recent',
};

/** Phần của một đơn trong `bookings.mine` mà khối "chờ viết bài" cần để lọc. */
export type AwaitingReviewTripInput = Pick<
  Booking,
  'code' | 'status' | 'departureCancelled' | 'departureEndDate'
>;

/**
 * Chuyến đã về mà khách chưa viết bài — lối thứ ba vào R1, sau P6 và hoá đơn (open-items P5b-5
 * mục 1). Danh sách đơn không mang bài viết (`reviewedAt` của `bookings.mine` luôn null), nên
 * "chưa có bài" đọc từ `reviews.mine`: đơn nào đã có bài ở đó, chờ duyệt, bị bác hay đã rút, là
 * bài sống ở R4 rồi. Phần còn lại đi qua đúng cổng của hoá đơn (`canWriteReview`). Chuyến về gần
 * nhất đứng đầu: đó là chuyến khách còn nhớ rõ nhất.
 */
export function tripsAwaitingReview<T extends AwaitingReviewTripInput>(
  bookings: readonly T[],
  reviews: readonly Pick<MyReview, 'bookingCode'>[],
  now: Date,
): T[] {
  const reviewed = new Set(reviews.map((review) => review.bookingCode));
  return bookings
    .filter(
      (booking) => !reviewed.has(booking.code) && canWriteReview({ ...booking, review: null }, now),
    )
    .sort((a, b) => b.departureEndDate.localeCompare(a.departureEndDate));
}
