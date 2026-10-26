import { type Booking, bookingPhase, type MyReview, vietnamToday } from '@tourism/contract';
import { tripsAwaitingReview } from '@/features/reviews/my-reviews';
import { currentTripDay, daysBetween } from '@/features/trip-tracker/trip-tracker';

/**
 * Logic thuần của trung tâm thông báo (spec 2026-10-25): danh sách được SUY RA từ đơn và review đã có
 * trong cache, không có bảng thông báo ở máy chủ. Hàm không đọc đồng hồ — `today` (ngày server) và `now`
 * do route truyền vào, cùng nếp `trips-list.ts`.
 */
export type NotificationKind =
  | 'payment_due'
  | 'on_tour'
  | 'departing'
  | 'trip_cancelled'
  | 'refunded'
  | 'review_prompt'
  | 'review_rejected'
  | 'review_approved';

export interface AppNotification {
  /** `<loại>:<mã đơn hoặc id review>` — ổn định qua các lần tải lại, dùng làm khoá "đã đọc". */
  id: string;
  kind: NotificationKind;
  tourTitle: string | null;
  imageUrl: string | null;
  /** Mã đơn — có ở mọi loại về đơn và `review_prompt`. */
  code: string | null;
  /** Id review — có ở `review_rejected` và `review_approved`. */
  reviewId: string | null;
  /** Số ngày tới ngày đi — chỉ `departing`. */
  daysUntil?: number;
  /** Ngày thứ mấy của chuyến và tổng số ngày — chỉ `on_tour`. */
  dayOfTrip?: number;
  totalDays?: number;
}

export type NotificationBookingInput = Pick<
  Booking,
  | 'code'
  | 'status'
  | 'tourTitle'
  | 'tourImage'
  | 'departureStartDate'
  | 'departureEndDate'
  | 'departureCancelled'
  | 'cancelledAt'
>;

export type NotificationReviewInput = Pick<
  MyReview,
  'id' | 'moderationState' | 'tourTitle' | 'tourImage' | 'bookingCode' | 'createdAt'
>;

/** Chuyến sắp đi chỉ được báo khi còn không quá chừng này ngày — xa hơn thì chưa có gì để nhắc. */
export const DEPARTING_WINDOW_DAYS = 30;
/** Mời viết review trong chừng này ngày sau khi về — sau đó coi như quá muộn, khỏi làm rối danh sách. */
export const REVIEW_PROMPT_WINDOW_DAYS = 60;
/** Báo chuyến bị huỷ / đã hoàn tiền trong chừng này ngày kể từ ngày về — sau đó tin cũ không còn gì để nhắc. */
export const CANCELLED_WINDOW_DAYS = 30;
/** Báo "review được duyệt" trong chừng này ngày kể từ ngày viết. */
export const REVIEW_APPROVED_WINDOW_DAYS = 14;

/** Thứ tự hiện: việc cần làm ngay lên trước, tin vui xuống cuối. */
const RANK: Record<NotificationKind, number> = {
  payment_due: 0,
  on_tour: 1,
  departing: 2,
  trip_cancelled: 3,
  refunded: 3,
  review_prompt: 4,
  review_rejected: 5,
  review_approved: 6,
};

export function buildNotifications(input: {
  bookings: readonly NotificationBookingInput[];
  reviews: readonly NotificationReviewInput[];
  today: string;
  now: Date;
}): AppNotification[] {
  const { bookings, reviews, today, now } = input;
  const list: AppNotification[] = [];

  const ofBooking = (
    kind: NotificationKind,
    booking: NotificationBookingInput,
    extra: Partial<AppNotification> = {},
  ): AppNotification => ({
    id: `${kind}:${booking.code}`,
    kind,
    tourTitle: booking.tourTitle,
    imageUrl: booking.tourImage?.url ?? null,
    code: booking.code,
    reviewId: null,
    ...extra,
  });

  for (const booking of bookings) {
    // `bookingPhase` đã gộp luật đơn còn chuyến (`bookingKeepsTrip`): REFUNDED chưa có mốc huỷ là hoàn
    // tiền thiện chí, khách vẫn đi (ADR-0054 AMEND 1), nên được nhắc "đang đi"/"sắp đi" như tab Trips.
    const phase = bookingPhase(booking, today);

    if (phase === 'awaiting_payment') {
      list.push(ofBooking('payment_due', booking));
    } else if (phase === 'on_tour') {
      const totalDays = daysBetween(booking.departureStartDate, booking.departureEndDate) + 1;
      list.push(
        ofBooking('on_tour', booking, {
          totalDays,
          dayOfTrip: currentTripDay(today, booking.departureStartDate, totalDays),
        }),
      );
    } else if (phase === 'upcoming') {
      const daysUntil = daysBetween(today, booking.departureStartDate);
      if (daysUntil <= DEPARTING_WINDOW_DAYS) {
        list.push(ofBooking('departing', booking, { daysUntil }));
      }
    } else if (phase === 'cancelled') {
      // Chuyến bị CÔNG TY huỷ, hoặc đơn đã hoàn tiền sau huỷ. Đơn khách tự huỷ (CANCELLED) khách đã biết.
      // Tin cũ quá hạn thì bỏ: chuyến chưa tới ngày về (số âm) vẫn còn báo.
      if (daysBetween(booking.departureEndDate, today) > CANCELLED_WINDOW_DAYS) continue;
      if (booking.departureCancelled) list.push(ofBooking('trip_cancelled', booking));
      else if (booking.status === 'REFUNDED') list.push(ofBooking('refunded', booking));
    }
  }

  // Đi xong mà chưa có bài: cổng `canWriteReview` của hoá đơn, bỏ chuyến đã có bài ở My reviews.
  for (const booking of tripsAwaitingReview(bookings, reviews, now)) {
    if (daysBetween(booking.departureEndDate, today) <= REVIEW_PROMPT_WINDOW_DAYS) {
      list.push(ofBooking('review_prompt', booking));
    }
  }

  for (const review of reviews) {
    const base = {
      tourTitle: review.tourTitle,
      imageUrl: review.tourImage?.url ?? null,
      code: null,
      reviewId: review.id,
    };
    if (review.moderationState === 'rejected') {
      list.push({ id: `review_rejected:${review.id}`, kind: 'review_rejected', ...base });
    } else if (
      review.moderationState === 'approved' &&
      daysBetween(vietnamToday(new Date(review.createdAt)), today) <= REVIEW_APPROVED_WINDOW_DAYS
    ) {
      list.push({ id: `review_approved:${review.id}`, kind: 'review_approved', ...base });
    }
  }

  return list.sort(
    (a, b) =>
      RANK[a.kind] - RANK[b.kind] ||
      (a.daysUntil ?? 0) - (b.daysUntil ?? 0) ||
      a.id.localeCompare(b.id),
  );
}

/** Số thông báo chưa đọc = số `id` không nằm trong tập đã đọc. */
export function countUnread(
  notifications: readonly AppNotification[],
  readIds: ReadonlySet<string>,
): number {
  return notifications.filter((notification) => !readIds.has(notification.id)).length;
}

/** Màn mở khi bấm một thông báo — cùng luật điều hướng với tab Trips (đơn còn đi → cụm P, còn lại → hoá đơn). */
export function notificationTarget(notification: AppNotification): string {
  switch (notification.kind) {
    case 'payment_due':
    case 'trip_cancelled':
    case 'refunded':
      return `/bookings/${notification.code}`;
    case 'on_tour':
    case 'departing':
      return `/trips/${notification.code}`;
    case 'review_prompt':
      return `/trips/${notification.code}/review`;
    case 'review_rejected':
    case 'review_approved':
      return `/reviews/${notification.reviewId}`;
  }
}
