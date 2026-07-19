import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  AdminBookingDetailSchema,
  AdminBookingsListQuerySchema,
  AdminCancellationRequestSchema,
  AdminCancellationsListQuerySchema,
  AdminRefundInputSchema,
  AdminRefundResultSchema,
  BookingCodeSchema,
  BookingSchema,
  BookingsListQuerySchema,
  CancelBookingInputSchema,
  CancellationRequestSchema,
  CreateBookingInputSchema,
  DecideCancellationInputSchema,
  DecideCancellationResultSchema,
} from './schemas/bookings.js';
import {
  DestinationSchema,
  HealthSchema,
  PagedSchema,
  TourCardSchema,
  TourCategorySchema,
  TourDetailSchema,
  ToursListQuerySchema,
} from './schemas/catalog.js';
import { PageQuerySchema } from './schemas/common.js';
import {
  AdminReviewSchema,
  AdminReviewsQuerySchema,
  CreateReviewInputSchema,
  ModerateReviewInputSchema,
  MyReviewSchema,
  PublicReviewSchema,
  ReviewsByTourQuerySchema,
} from './schemas/reviews.js';
import {
  CheckWishlistInputSchema,
  CheckWishlistResultSchema,
  SetWishlistInputSchema,
  SetWishlistResultSchema,
  WishlistItemSchema,
} from './schemas/wishlist.js';

/**
 * oRPC contract v1 (spec §6) — health + catalog read public. Được implement ở
 * `@tourism/api` qua `@orpc/nest` `@Implement`; P3 web tiêu thụ qua
 * `ContractRouterClient<ContractRouter>`.
 *
 * Mỗi procedure mang một `.route` path kiểu REST tường minh — @orpc/nest mount
 * controller ĐÚNG các path này (không thêm prefix), nên phải tự đặt namespace
 * `/api` để nằm cạnh `/api/auth/*` (Better Auth) và không đụng `/health` trần
 * của infra probe.
 */
export const contract = {
  health: {
    check: oc
      .route({
        method: 'GET',
        path: '/api/health',
        summary: 'API liveness (contract flavour of the /health infra probe)',
      })
      .output(HealthSchema),
  },
  catalog: {
    tours: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/tours',
          summary: 'List published tours (filter + paginate)',
        })
        .input(ToursListQuerySchema)
        .output(PagedSchema(TourCardSchema)),
      bySlug: oc
        .route({
          method: 'GET',
          path: '/api/tours/{slug}',
          summary: 'Published tour detail incl. upcoming OPEN departures',
        })
        .input(z.object({ slug: z.string().min(1).max(120) }))
        .errors({
          NOT_FOUND: { message: 'Tour not found' },
        })
        .output(TourDetailSchema),
    },
    destinations: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/destinations',
          summary: 'List active destinations with published-tour counts',
        })
        .output(z.array(DestinationSchema)),
    },
    categories: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/categories',
          summary: 'List active tour categories',
        })
        .output(z.array(TourCategorySchema)),
    },
  },
  /**
   * Review phía khách. `create` và `mine` CẦN AUTH (AuthGuard trên
   * controller, cùng mô hình `bookings.{create,mine}` — contract oRPC không
   * mang metadata auth, guard chạy TRƯỚC interceptor oRPC nên call ẩn danh
   * bị 401 trước khi parse input); `listByTour` là public.
   */
  reviews: {
    listByTour: oc
      .route({
        method: 'GET',
        path: '/api/tours/{tourSlug}/reviews',
        summary: 'Approved reviews of a tour',
      })
      .input(ReviewsByTourQuerySchema)
      .output(PagedSchema(PublicReviewSchema))
      .errors({ TOUR_NOT_FOUND: { status: 404, message: 'Tour not found' } }),

    /**
     * Review của chính user gọi API — path riêng `/api/reviews/mine`
     * (KHÔNG đụng `POST /api/reviews` của `create`, khác method lẫn path).
     * Trả CẢ review chưa duyệt: đây là review của chính họ, họ có quyền thấy
     * nó tồn tại/đang chờ duyệt. Output dùng `MyReviewSchema` (có thêm
     * `isApproved` so với `PublicReviewSchema`) để FE hiện badge "đang chờ
     * duyệt" — không thì khách tưởng review đã gửi thất bại rồi gửi lại,
     * ăn `REVIEW_ALREADY_EXISTS`.
     */
    mine: oc
      .route({
        method: 'GET',
        path: '/api/reviews/mine',
        summary: "List caller's own reviews, newest first (authed, paged, includes unapproved)",
      })
      .input(PageQuerySchema)
      .output(PagedSchema(MyReviewSchema)),

    create: oc
      .route({
        method: 'POST',
        path: '/api/reviews',
        summary: 'Write a review for a completed booking',
      })
      .input(CreateReviewInputSchema)
      .output(PublicReviewSchema)
      .errors({
        BOOKING_NOT_FOUND: { status: 404, message: 'Booking not found' },
        // 403 cố ý, KHÔNG 404: khách đã thấy mã này trong danh sách của mình
        // nên che giấu là giả tạo.
        BOOKING_FORBIDDEN: { status: 403, message: 'Not your booking' },
        REVIEW_NOT_ELIGIBLE: { status: 400, message: 'Booking is not eligible for review' },
        REVIEW_TRIP_NOT_COMPLETED: { status: 400, message: 'Trip has not finished yet' },
        REVIEW_ALREADY_EXISTS: { status: 409, message: 'This booking already has a review' },
      }),
  },
  /**
   * Wishlist — MỌI procedure đều CẦN AUTH (AuthGuard chạy toàn cục theo
   * ADR-0003; không khai @Public() nghĩa là cần đăng nhập).
   */
  wishlist: {
    set: oc
      .route({ method: 'POST', path: '/api/wishlist', summary: 'Add/remove a tour (idempotent)' })
      .input(SetWishlistInputSchema)
      .output(SetWishlistResultSchema)
      .errors({ TOUR_NOT_FOUND: { status: 404, message: 'Tour not found' } }),
    list: oc
      .route({ method: 'GET', path: '/api/wishlist', summary: 'List own wishlist, newest first' })
      .input(PageQuerySchema)
      .output(PagedSchema(WishlistItemSchema)),
    check: oc
      .route({
        method: 'POST',
        path: '/api/wishlist/check',
        summary: 'Which of these tours are wished (batch)',
      })
      .input(CheckWishlistInputSchema)
      .output(CheckWishlistResultSchema),
  },
  /**
   * Booking phía khách (spec P2 §3, W1) — mọi procedure ở đây đều CẦN AUTH:
   * contract oRPC cố ý không mang metadata auth; việc chặn do `AuthGuard` của
   * Nest đảm nhiệm trên controller implement (guard chạy TRƯỚC interceptor
   * oRPC, nên call ẩn danh bị 401 trước cả khi parse input).
   */
  bookings: {
    create: oc
      .route({
        method: 'POST',
        path: '/api/bookings',
        summary: 'Create a PENDING booking + gateway checkout session (authed)',
      })
      .input(CreateBookingInputSchema)
      .errors({
        // Departure không tồn tại, không OPEN, đã khởi hành, hoặc tour chưa
        // publish — cố ý gộp thành MỘT code: caller không làm gì khác được với
        // sự khác biệt đó, mà code chi tiết sẽ leak sự tồn tại của tour ẩn.
        DEPARTURE_NOT_AVAILABLE: {
          status: 400,
          message: 'This departure is not available for booking',
        },
        SEATS_UNAVAILABLE: {
          status: 409,
          message: 'Not enough seats left on this departure',
        },
      })
      .output(BookingSchema),
    mine: oc
      .route({
        method: 'GET',
        path: '/api/bookings',
        summary: 'List own bookings, newest first (authed, paged)',
      })
      .input(BookingsListQuerySchema)
      .output(PagedSchema(BookingSchema)),
    byCode: oc
      .route({
        method: 'GET',
        path: '/api/bookings/{code}',
        summary: 'Own booking detail by code (authed, owner-only)',
      })
      .input(z.object({ code: BookingCodeSchema }))
      .errors({
        // Trả cả khi truy cập booking của user khác — owner-or-404.
        NOT_FOUND: { message: 'Booking not found' },
      })
      .output(BookingSchema),
    cancel: oc
      .route({
        method: 'POST',
        path: '/api/bookings/{code}/cancel',
        summary: 'Request cancellation of an own PAID booking (authed, owner-only)',
      })
      .input(CancelBookingInputSchema)
      .errors({
        // Owner-or-404, cùng policy với byCode.
        NOT_FOUND: { message: 'Booking not found' },
        // Partial unique index đã nổ — đang tồn tại một row REQUESTED còn sống.
        ALREADY_REQUESTED: {
          status: 409,
          message: 'A cancellation request is already open for this booking',
        },
        // Booking chưa PAID, hoặc departure đã khởi hành — gộp một code: cách
        // nào thì booking này cũng không vào được flow cancellation.
        NOT_CANCELLABLE: {
          status: 422,
          message: 'Only a PAID booking with a future departure can be cancelled',
        },
      })
      .output(CancellationRequestSchema),
  },
  /**
   * Surface admin (spec P2 §3, W3). Cùng mô hình guard với `bookings`:
   * contract không mang metadata auth; controller implement xếp chồng
   * `AuthGuard` + `@Roles('ADMIN')` (ẩn danh → 401, không phải admin → 403)
   * trước khi oRPC parse bất cứ thứ gì.
   */
  admin: {
    bookings: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/bookings',
          summary: 'List ALL bookings (admin, paged, status/search filters)',
        })
        .input(AdminBookingsListQuerySchema)
        .output(PagedSchema(BookingSchema)),
      byCode: oc
        .route({
          method: 'GET',
          path: '/api/admin/bookings/{code}',
          summary: 'Any booking by code + cancellation history (admin — not owner-scoped)',
        })
        .input(z.object({ code: BookingCodeSchema }))
        .errors({
          NOT_FOUND: { message: 'Booking not found' },
        })
        .output(AdminBookingDetailSchema),
      refund: oc
        .route({
          method: 'POST',
          path: '/api/admin/bookings/{code}/refund',
          summary: 'Issue a (partial) refund — appends a Refund ledger row',
        })
        .input(AdminRefundInputSchema)
        .errors({
          NOT_FOUND: { message: 'Booking not found' },
          // Các 422 bên dưới: request parse hợp lệ nhưng ledger/state từ chối.
          NOT_REFUNDABLE: {
            status: 422,
            message:
              'Only a PAID or PARTIALLY_REFUNDED booking with a captured payment is refundable',
          },
          OVER_TOTAL: {
            status: 422,
            message: 'Refund amount plus prior refunds would exceed the booking total',
          },
          ZERO_OR_NEGATIVE: {
            status: 422,
            message: 'Refund amount must be greater than zero',
          },
          NOTHING_LEFT: {
            status: 422,
            message: 'Booking is already fully refunded',
          },
          // Provider từ chối/lỗi khi gọi refund — chưa ghi gì vào ledger.
          REFUND_FAILED: {
            status: 502,
            message: 'Provider refund failed',
          },
        })
        .output(AdminRefundResultSchema),
    },
    /**
     * Hàng đợi cancellation (spec P2 W4, D1-B). `decide` là một endpoint cho
     * cả hai phán quyết: deny chỉ flip request; approve điều phối trọn gói
     * refund phần còn lại + booking CANCELLED + nhả seat.
     */
    cancellations: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/cancellations',
          summary: 'List cancellation requests (admin, paged, status filter)',
        })
        .input(AdminCancellationsListQuerySchema)
        .output(PagedSchema(AdminCancellationRequestSchema)),
      decide: oc
        .route({
          method: 'POST',
          path: '/api/admin/cancellations/{id}/decide',
          summary: 'Approve (refund + cancel + release seats) or deny a request',
        })
        .input(DecideCancellationInputSchema)
        .errors({
          NOT_FOUND: { message: 'Cancellation request not found' },
          // Request đã DENIED/REFUNDED — quyết định là chung cuộc (history
          // append-only: khách muốn nữa thì gửi request MỚI).
          ALREADY_DECIDED: {
            status: 409,
            message: 'This cancellation request has already been decided',
          },
          // Chỉ ở nhánh approve: booking không còn phần refund được / không có
          // payment đã capture (cùng lớp gate với admin.bookings.refund).
          NOT_REFUNDABLE: {
            status: 422,
            message: 'Booking has no refundable remainder to approve against',
          },
          // Chỉ ở nhánh approve: provider từ chối/lỗi khi gọi refund — chưa ghi
          // gì vào ledger và request vẫn ở REQUESTED.
          REFUND_FAILED: {
            status: 502,
            message: 'Provider refund failed',
          },
        })
        .output(DecideCancellationResultSchema),
    },
    /**
     * Hàng đợi moderation review (spec P3a-A W1). `list` mặc định trả TẤT CẢ
     * (kể cả chưa duyệt) để admin có cái nhìn đầy đủ; `moderate` là transaction
     * 4-trong-1 (flip trạng thái + audit trail + recompute rating tour +
     * enqueue email) — xem `ReviewsService.moderate`.
     */
    reviews: {
      list: oc
        .route({ method: 'GET', path: '/api/admin/reviews', summary: 'Moderation queue' })
        .input(AdminReviewsQuerySchema)
        .output(PagedSchema(AdminReviewSchema)),

      moderate: oc
        .route({
          method: 'POST',
          path: '/api/admin/reviews/{id}/moderate',
          summary: 'Approve or unapprove a review',
        })
        .input(ModerateReviewInputSchema)
        .output(AdminReviewSchema)
        .errors({ REVIEW_NOT_FOUND: { status: 404, message: 'Review not found' } }),
    },
  },
};

export type ContractRouter = typeof contract;
