import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  AdminTourRowSchema,
  AdminTourSetPublishedInputSchema,
  AdminTourSetPublishedResultSchema,
  AdminToursListQuerySchema,
} from './schemas/admin-catalog.js';
import {
  AdminDepartureCreateInputSchema,
  AdminDepartureRowSchema,
  AdminDepartureSetStatusInputSchema,
  AdminDeparturesListQuerySchema,
  AdminDeparturesListResultSchema,
  AdminDepartureUpdateInputSchema,
} from './schemas/admin-departures.js';
import {
  AdminBookingDetailSchema,
  AdminBookingsListQuerySchema,
  AdminRefundInputSchema,
  AdminRefundResultSchema,
  BookingCodeSchema,
  BookingDetailSchema,
  BookingSchema,
  BookingsListQuerySchema,
  CancelBookingInputSchema,
  CancelBookingResultSchema,
  CreateBookingInputSchema,
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
  AdminEnquiriesListQuerySchema,
  AdminEnquiryAddNoteInputSchema,
  AdminEnquiryAddNoteResultSchema,
  AdminEnquiryByIdInputSchema,
  AdminEnquirySetStatusInputSchema,
  AdminEnquirySetStatusResultSchema,
  CreateEnquiryInputSchema,
  EnquiryDetailSchema,
  EnquiryResultSchema,
  EnquiryRowSchema,
} from './schemas/enquiries.js';
import { SignedUploadParamsSchema, SignUploadInputSchema } from './schemas/media.js';
import {
  AdminSubscribersListQuerySchema,
  AdminSubscribersListResultSchema,
  AdminSubscriberUnsubscribeInputSchema,
  AdminSubscriberUnsubscribeResultSchema,
  ConfirmSubscriptionInfoSchema,
  ConfirmSubscriptionInputSchema,
  ConfirmSubscriptionResultSchema,
  ResubscribeInputSchema,
  ResubscribeResultSchema,
  SubscribeInputSchema,
  SubscribeResultSchema,
  UnsubscribeConfirmResultSchema,
  UnsubscribeInputSchema,
  UnsubscribeResultSchema,
} from './schemas/newsletter.js';
import {
  AdminOutboxListQuerySchema,
  AdminOutboxRetryInputSchema,
  OutboxRowSchema,
} from './schemas/outbox.js';
import {
  AdminPaymentEventByIdInputSchema,
  AdminPaymentEventsListQuerySchema,
  PaymentEventDetailSchema,
  PaymentEventRowSchema,
} from './schemas/payment-events.js';
import {
  PostCardSchema,
  PostDetailSchema,
  PostsListQuerySchema,
  PostTagSchema,
} from './schemas/posts.js';
import { AdminMonthlyReportQuerySchema, AdminMonthlyReportSchema } from './schemas/reports.js';
import {
  AdminReviewSchema,
  AdminReviewsQuerySchema,
  CreateReviewInputSchema,
  ModerateReviewInputSchema,
  MyReviewSchema,
  PublicReviewSchema,
  RetractReviewInputSchema,
  ReviewBreakdownSchema,
  ReviewsByTourQuerySchema,
  UpdateReviewInputSchema,
} from './schemas/reviews.js';
import { SiteMediaEntrySchema } from './schemas/site-media.js';
import {
  AdminBookingsStatsSchema,
  AdminDashboardQuerySchema,
  AdminDashboardSeriesSchema,
  AdminEnquiriesStatsSchema,
  AdminOutboxStatsSchema,
  AdminPaymentEventsStatsSchema,
  AdminReviewsStatsSchema,
  AdminStatsRangeQuerySchema,
  AdminSubscribersStatsSchema,
} from './schemas/stats.js';
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
   * Blog công khai (spec §4.6, P3a-C) — card GỌN (không `content`), lọc bài
   * published qua `publishedPostWhere()` (ADR-0004).
   */
  posts: {
    list: oc
      .route({ method: 'GET', path: '/api/posts', summary: 'List published blog posts' })
      .input(PostsListQuerySchema)
      .output(PagedSchema(PostCardSchema)),
    bySlug: oc
      .route({ method: 'GET', path: '/api/posts/{slug}', summary: 'Get a published post by slug' })
      .input(z.object({ slug: z.string().min(1).max(80) }))
      .output(PostDetailSchema)
      .errors({ POST_NOT_FOUND: { status: 404, message: 'Post not found' } }),
    /**
     * Tag toàn cục CÓ ≥1 bài published (Task 6). Path RIÊNG `/api/posts-tags`
     * (KHÔNG `/api/posts/tags`) để tách khỏi `bySlug` `/api/posts/{slug}` —
     * oRPC procedure-based nên hai path không thực sự đụng nhau, nhưng đặt
     * tách cho rõ (đừng tạo post có slug "tags"). KHÔNG paged — danh sách tag
     * toàn cục luôn nhỏ.
     */
    tags: oc
      .route({
        method: 'GET',
        path: '/api/posts-tags',
        summary: 'List blog tags with published-post counts',
      })
      .output(z.array(PostTagSchema)),
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
      // `breakdown` = số review theo từng mức sao, tính trên tập CHƯA lọc
      // theo `rating` — modal "xem tất cả review" cần con số này ổn định để
      // người dùng bấm qua lại các nút lọc sao mà không thấy nút khác về 0.
      .output(PagedSchema(PublicReviewSchema).extend({ breakdown: ReviewBreakdownSchema }))
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
        REVIEW_PHOTO_INVALID: { status: 400, message: 'A photo does not belong to this booking' },
      }),

    /**
     * Sửa review của CHÍNH mình (ADR-0032). Thay TRỌN nội dung kèm ảnh, rồi
     * review quay về hàng đợi kiểm duyệt.
     *
     * `PATCH` chứ không `PUT`: thân request chỉ mang phần NỘI DUNG, còn danh
     * tính (booking, tác giả, trạng thái) thì server giữ — một `PUT` ngụ ý
     * client gửi trọn tài nguyên và có quyền đặt cả những thứ ấy.
     *
     * `REVIEW_NOT_FOUND` cho cả ca không-phải-của-mình (khác `create`, nơi 403
     * là đúng vì khách đã thấy mã booking trong danh sách của họ): id review
     * của người khác thì họ chưa từng thấy, nên xác nhận nó tồn tại là rò rỉ.
     */
    update: oc
      .route({
        method: 'PATCH',
        path: '/api/reviews/{id}',
        summary: 'Rewrite your own review and send it back for moderation',
      })
      .input(UpdateReviewInputSchema)
      .output(MyReviewSchema)
      .errors({
        REVIEW_NOT_FOUND: { status: 404, message: 'Review not found' },
        /** Đã duyệt (không sửa được), hoặc đã bác đủ số lần (hết đường). */
        REVIEW_NOT_EDITABLE: { status: 409, message: 'This review can no longer be edited' },
        REVIEW_PHOTO_INVALID: { status: 400, message: 'A photo does not belong to this booking' },
      }),
    /**
     * W4 U2 (ADR-0032 AMEND 1): tác giả RÚT review ĐÃ DUYỆT khỏi site —
     * chung cuộc (admin không duyệt lại, tác giả không sửa tiếp). Ảnh
     * requeue GC, rating recompute, cache trang tour bust — như một lượt
     * unpublish nhưng do CHÍNH CHỦ và không đảo được. Cùng luật 404 chống dò
     * với `update`.
     */
    retract: oc
      .route({
        method: 'POST',
        path: '/api/reviews/{id}/retract',
        summary: 'Retract your own published review (final)',
      })
      .input(RetractReviewInputSchema)
      .output(MyReviewSchema)
      .errors({
        REVIEW_NOT_FOUND: { status: 404, message: 'Review not found' },
        /** Chưa/không còn ở trạng thái đã-duyệt (pending/rejected/đã rút). */
        REVIEW_NOT_RETRACTABLE: {
          status: 409,
          message: 'Only a published review can be retracted',
        },
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
   * Form liên hệ công khai (spec §4.3) — endpoint GHI đầu tiên khách CHƯA
   * đăng nhập gọi được (`@Public()` trên controller, ADR-0003), có
   * `@UseGuards(ThrottlerGuard)` riêng chống spam (`PUBLIC_WRITE_THROTTLE`).
   *
   * Giữ mặc định 200 của oRPC (KHÔNG khai `successStatus: 201`) — mọi
   * endpoint create khác trong repo (bookings, reviews, wishlist) đều 200,
   * lệch một chỗ thành vết chắp vá bắt FE nhớ ngoại lệ. Muốn 201 cho mọi
   * create thì làm đồng loạt ở một đợt sửa riêng, không lẻ tẻ từng endpoint.
   */
  enquiries: {
    create: oc
      .route({
        method: 'POST',
        path: '/api/enquiries',
        summary: 'Submit a contact enquiry',
      })
      .input(CreateEnquiryInputSchema)
      .output(EnquiryResultSchema)
      .errors({ TOUR_NOT_FOUND: { status: 404, message: 'Tour not found' } }),
  },
  /**
   * Đăng ký nhận bản tin (spec §4.4, nửa đầu) — endpoint GHI công khai thứ
   * hai (`@Public()`, cùng `PUBLIC_WRITE_THROTTLE` với enquiries). Output
   * LUÔN `{subscribed: true}` — xem JSDoc ở `SubscribeResultSchema` — nên
   * KHÔNG khai `.errors()` nào: mọi nhánh (mới/đã có/honeypot) đều thành
   * công theo response, không có gì để phân biệt bằng error code.
   */
  newsletter: {
    subscribe: oc
      .route({
        method: 'POST',
        path: '/api/newsletter/subscribe',
        summary: 'Subscribe to the newsletter (idempotent, anti email-enumeration)',
      })
      .input(SubscribeInputSchema)
      .output(SubscribeResultSchema),
    /**
     * Huỷ đăng ký (spec §4.4, nửa sau) — v2 làm hơn Nexora (không có
     * unsubscribe công khai, rủi ro GDPR/CAN-SPAM). Tách GET/POST cố ý:
     * email client (Gmail, Outlook) prefetch mọi link trong thư để quét
     * virus — nếu GET tự huỷ thì khách bị huỷ mà chưa hề bấm. GET chỉ trả dữ
     * liệu cho trang xác nhận (KHÔNG side effect); POST mới thực thi.
     * `id`/`token` lấy thẳng từ link trong email nên KHÔNG cần đăng nhập.
     */
    unsubscribeConfirm: oc
      .route({
        method: 'GET',
        path: '/api/newsletter/unsubscribe',
        summary: 'Confirmation page data (read-only, no side effect)',
      })
      .input(UnsubscribeInputSchema)
      .output(UnsubscribeConfirmResultSchema)
      .errors({ INVALID_UNSUBSCRIBE_TOKEN: { status: 400, message: 'Invalid unsubscribe link' } }),
    unsubscribe: oc
      .route({
        method: 'POST',
        path: '/api/newsletter/unsubscribe',
        summary: 'Execute unsubscribe (idempotent)',
      })
      .input(UnsubscribeInputSchema)
      .output(UnsubscribeResultSchema)
      .errors({ INVALID_UNSUBSCRIBE_TOKEN: { status: 400, message: 'Invalid unsubscribe link' } }),
    /**
     * Đăng ký LẠI NGAY sau khi huỷ (vá review Task 6 — Khoản 1, siết W4 E4):
     * token mục đích `resubscribe` phát duy nhất ở POST `unsubscribe` vừa
     * thành công, hạn 30 ngày (xem JSDoc `ResubscribeInputSchema`).
     *
     * BẮT BUỘC `method: 'POST'`, TUYỆT ĐỐI KHÔNG được thêm biến thể GET:
     * email client (Gmail, Outlook) prefetch mọi link trong thư để quét
     * virus — một GET resubscribe sẽ tự đăng ký lại đúng người VỪA huỷ, y
     * hệt cái bẫy mà việc tách GET/POST của `unsubscribeConfirm`/`unsubscribe`
     * ở trên sinh ra để tránh (spec §4.4). Route này chỉ tồn tại dưới dạng
     * POST — không có `unsubscribeConfirm`-style GET song song.
     */
    resubscribe: oc
      .route({
        method: 'POST',
        path: '/api/newsletter/resubscribe',
        summary: 'Undo a just-completed unsubscribe with the resubscribe token (POST only)',
      })
      .input(ResubscribeInputSchema)
      .output(ResubscribeResultSchema)
      .errors({ INVALID_UNSUBSCRIBE_TOKEN: { status: 400, message: 'Invalid unsubscribe link' } }),
    /**
     * Double opt-in (W4 E3, ADR-0039 §2) — xác nhận đăng ký từ link trong
     * thư đầu. Tách GET/POST cùng lý do với `unsubscribeConfirm`: mail
     * client prefetch link, GET tự confirm là bot của Gmail "đồng ý" hộ
     * khách. Token mục đích `confirm` (E4) — link unsubscribe không đổi
     * chỗ được.
     */
    confirmInfo: oc
      .route({
        method: 'GET',
        path: '/api/newsletter/confirm',
        summary: 'Confirm-subscription page data (read-only, no side effect)',
      })
      .input(ConfirmSubscriptionInputSchema)
      .output(ConfirmSubscriptionInfoSchema)
      .errors({ INVALID_CONFIRM_TOKEN: { status: 400, message: 'Invalid confirmation link' } }),
    confirm: oc
      .route({
        method: 'POST',
        path: '/api/newsletter/confirm',
        summary: 'Execute subscription confirmation (idempotent claim)',
      })
      .input(ConfirmSubscriptionInputSchema)
      .output(ConfirmSubscriptionResultSchema)
      .errors({ INVALID_CONFIRM_TOKEN: { status: 400, message: 'Invalid confirmation link' } }),
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
        // W1 (audit 05/09 cụm 2): party vượt `maxGroupSize` của tour — trước
        // đây trần này chỉ ép ở trình duyệt, POST thẳng lách được.
        PARTY_TOO_LARGE: {
          status: 422,
          message: 'Party size exceeds the maximum group size for this tour',
        },
        // BK-1: gateway lỗi lúc mint checkout — booking ĐÃ tạo (PENDING), khách
        // retry qua `checkout`. Typed để FE phân biệt với hết-ghế/không-available.
        CHECKOUT_FAILED: {
          status: 502,
          message: 'Checkout could not be started, please retry',
        },
      })
      .output(BookingSchema),
    checkout: oc
      .route({
        method: 'POST',
        path: '/api/bookings/{code}/checkout',
        summary: 'Re-mint checkout session for an own PENDING booking (authed, owner-only)',
      })
      .input(z.object({ code: BookingCodeSchema }))
      .errors({
        NOT_FOUND: { message: 'Booking not found' },
        NOT_PENDING: { status: 422, message: 'Only a PENDING booking can be checked out' },
        // ADR-0009 AMEND 2: cùng gate chuyến với `create` — không mint trang
        // thanh toán cho chuyến mà claim chắc chắn từ chối.
        DEPARTURE_NOT_AVAILABLE: {
          status: 400,
          message: 'This departure is not available for booking',
        },
        CHECKOUT_FAILED: { status: 502, message: 'Checkout could not be started, please retry' },
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
      // `BookingDetailSchema` (không phải `BookingSchema`): CHỈ route này mang
      // kèm review của khách — xem JSDoc ở schema, mở rộng cho mọi route dùng
      // booking sẽ làm nổ suy kiểu của cả router.
      .output(BookingDetailSchema),
    cancel: oc
      .route({
        method: 'POST',
        path: '/api/bookings/{code}/cancel',
        summary:
          'Cancel an own paid booking now; full refund before the cancellation deadline (authed, owner-only)',
      })
      .input(CancelBookingInputSchema)
      .errors({
        // Owner-or-404, cùng policy với byCode.
        NOT_FOUND: { message: 'Booking not found' },
        // ADR-0041: trạng thái ngoài PAID/PARTIALLY_REFUNDED, không có capture,
        // đã tới ngày khởi hành (giờ Việt Nam), hoặc lệnh huỷ thứ hai — gộp một
        // code: cách nào thì booking cũng không huỷ online được nữa.
        NOT_CANCELLABLE: { status: 422, message: 'This booking can no longer be cancelled online' },
        // Số server sắp hoàn khác `expectedRefundAmount` khách đã xác nhận — không huỷ gì;
        // trang đọc lại cờ huỷ và hỏi lại với số mới.
        REFUND_AMOUNT_CHANGED: {
          status: 409,
          message: 'The refund amount has changed; review it and confirm again',
        },
        // Cổng thanh toán từ chối hoàn — không ghi gì, booking giữ nguyên, thử lại được.
        REFUND_FAILED: { status: 502, message: 'Provider refund failed' },
      })
      .output(CancelBookingResultSchema),
    cancelPending: oc
      .route({
        method: 'POST',
        path: '/api/bookings/{code}/cancel-pending',
        summary: 'Owner cancels an own unpaid PENDING booking (authed, owner-only)',
      })
      .input(z.object({ code: BookingCodeSchema }))
      .errors({
        NOT_FOUND: { message: 'Booking not found' },
        NOT_PENDING: { status: 422, message: 'Only a PENDING booking can be cancelled this way' },
      })
      .output(BookingSchema),
  },
  /**
   * Brand-chrome media công khai (spec P3a-C W6) — danh sách slot ảnh/video
   * cố định trên web (hero trang chủ, cta-band, v.v.) hiện đang CÓ media.
   * Chỉ đọc DB `site_media_slots` rồi lọc slot có ≥1 asset (ADR-0005); danh
   * mục 9 key/kind là việc admin validate/sync (P4), không thuộc read-path.
   */
  siteMedia: {
    list: oc
      .route({
        method: 'GET',
        path: '/api/site-media',
        summary: 'List site brand-chrome media slots (only slots with media)',
      })
      .output(z.array(SiteMediaEntrySchema)),
  },
  media: {
    signUpload: oc
      .route({
        method: 'POST',
        path: '/api/media/upload-signatures',
        summary: 'Sign a direct-to-Cloudinary upload (ADR-0021)',
      })
      .input(SignUploadInputSchema)
      .output(SignedUploadParamsSchema)
      .errors({
        // 503 chứ không 500: thiếu cặp CLOUDINARY_API_KEY/SECRET là trạng
        // thái cấu hình hợp lệ (CI, môi trường chỉ-đọc) — API vẫn boot.
        MEDIA_UPLOAD_NOT_CONFIGURED: { status: 503, message: 'Uploads are not configured' },
        BOOKING_NOT_FOUND: { status: 404, message: 'Booking not found' },
        BOOKING_FORBIDDEN: { status: 403, message: 'Not your booking' },
        REVIEW_NOT_ELIGIBLE: { status: 400, message: 'Booking is not eligible for review' },
        REVIEW_TRIP_NOT_COMPLETED: { status: 400, message: 'Trip has not finished yet' },
      }),
  },

  // Namespace account: procedure oRPC ĐẦU TIÊN ở đây — me/delete vẫn là REST
  // thuần trong AccountController (gắn Better Auth session, không đáng port).
  account: {
    setAvatar: oc
      .route({
        method: 'PATCH',
        path: '/api/account/avatar',
        summary: 'Set or clear own avatar (ADR-0021)',
      })
      .input(
        z.object({
          /** publicId Cloudinary đã upload; null = gỡ avatar về chữ-cái-đầu.
           * `.max(300)` khớp varchar(300) của MediaAsset.publicId — thiếu trần
           * này thì chuỗi dài chết P2000 ở DB (500) thay vì 400 ở tầng validate. */
          publicId: z.string().min(1).max(300).nullable(),
        }),
      )
      .output(z.object({ image: z.url().nullable() }))
      .errors({
        AVATAR_PUBLIC_ID_INVALID: {
          status: 400,
          message: 'publicId is not one of your uploaded avatars',
        },
      }),
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
          // CANCELLED nằm trong tập hoàn được (ADR-0029 §3, ADR-0041 §5): khách
          // huỷ quá hạn giữ nguyên tiền, ngoại lệ đi qua đúng lệnh này.
          NOT_REFUNDABLE: {
            status: 422,
            message:
              'Only a PAID, PARTIALLY_REFUNDED or CANCELLED booking with a captured payment is refundable',
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
        .errors({
          REVIEW_NOT_FOUND: { status: 404, message: 'Review not found' },
          /** W4 U2: review tác giả đã rút — ý chí chung cuộc của CHÍNH CHỦ,
           * mọi động từ moderation đều bị chặn (kể cả approve lại). */
          REVIEW_RETRACTED: {
            status: 409,
            message: 'The author retracted this review — it cannot be moderated',
          },
        }),
    },
    /**
     * Số liệu vùng (spec P4b §3-F5) — MỘT endpoint cho mỗi trang vùng, mỗi
     * cái trả bộ metric của vùng đó kèm giá trị kỳ liền trước (xem
     * `schemas/stats.ts`: server trả cả hai số, client không tự chế delta).
     *
     * Vì sao ba endpoint chứ không một `admin.stats.all`: mỗi trang vùng chỉ
     * cần bộ của nó, và trang đó fetch stats SONG SONG với list (Promise.all)
     * — gộp làm một sẽ bắt `/reviews` chờ luôn cả aggregate tiền của
     * bookings. P4d dashboard cần nhiều bộ thì gọi song song ba cái.
     *
     * Input: chỉ vùng NÀO CÓ bộ lọc ngày trên trang mới có, và luôn optional
     * (ADR-0028) — hàng card ăn theo hai ô ngày của bảng ngay dưới nó, thiếu
     * tham số thì rơi về cửa sổ trượt 28 ngày như cũ. Hiện là `bookings` và
     * `reviews`, cùng dùng `AdminStatsRangeQuerySchema` chứ không mỗi vùng một
     * bản. Bốn endpoint vùng còn lại KHÔNG có input: trang
     * của chúng chưa có bộ lọc ngày nào, và thêm một tham số không ai gửi là
     * thêm một nhánh không ai test. Vùng nào mọc bộ lọc ngày thì lặp lại đúng
     * khuôn ấy, đừng dựng cửa sổ thứ hai. `dashboard` (ADR-0036) là loại khác
     * hẳn — chuỗi theo ngày, input `?days=` — không phải một vùng.
     *
     * KHÔNG khai lỗi nghiệp vụ: đọc thuần, không phán quyết gì. Guard
     * `AuthGuard` + `@Roles(ADMIN)` ở controller cho 401/403 như bảy endpoint
     * admin còn lại — contract không mang metadata auth.
     */
    stats: {
      bookings: oc
        .route({
          method: 'GET',
          path: '/api/admin/stats/bookings',
          summary: 'Bookings KPIs for a date range, against an equally long preceding one',
        })
        .input(AdminStatsRangeQuerySchema)
        .output(AdminBookingsStatsSchema),
      reviews: oc
        .route({
          method: 'GET',
          path: '/api/admin/stats/reviews',
          summary: 'Moderation queue + ratings for a date range, against an equally long one',
        })
        .input(AdminStatsRangeQuerySchema)
        .output(AdminReviewsStatsSchema),
      // F7 (spec P4c): sent là đếm trong kỳ; queued/failed là ảnh chụp một số đơn.
      outbox: oc
        .route({
          method: 'GET',
          path: '/api/admin/stats/outbox',
          summary: 'Emails sent in the last 28 days (and the 28 before) + queue snapshot',
        })
        .output(AdminOutboxStatsSchema),
      // F8 (spec P4c): received/linked là cặp hai kỳ (neo receivedAt);
      // unprocessed là ảnh chụp một số đơn.
      paymentEvents: oc
        .route({
          method: 'GET',
          path: '/api/admin/stats/payment-events',
          summary:
            'Webhooks received/linked in the last 28 days (and the 28 before) + unprocessed snapshot',
        })
        .output(AdminPaymentEventsStatsSchema),
      // F9 (spec P4c): created/won là cặp hai kỳ (won neo mốc của EVENT audit,
      // không phải `updatedAt`); open là ảnh chụp một số đơn.
      enquiries: oc
        .route({
          method: 'GET',
          path: '/api/admin/stats/enquiries',
          summary:
            'Enquiries received and won in the last 28 days (and the 28 before) + open snapshot',
        })
        .output(AdminEnquiriesStatsSchema),
      // F10 (spec P4c): created/unsubscribed là cặp hai kỳ (neo `created_at`
      // và `unsubscribed_at`); active là ảnh chụp một số đơn.
      subscribers: oc
        .route({
          method: 'GET',
          path: '/api/admin/stats/subscribers',
          summary:
            'Newsletter sign-ups and opt-outs in the last 28 days (and the 28 before) + active snapshot',
        })
        .output(AdminSubscribersStatsSchema),
      // P4d (ADR-0036): endpoint DUY NHẤT trả CHUỖI thay vì cặp hai kỳ — một
      // point mỗi ngày lịch UTC, đủ `days` point (ngày trống điền 0), cả hai
      // số neo `paid_at` như `revenue`/`paidBookings` của `bookings`.
      dashboard: oc
        .route({
          method: 'GET',
          path: '/api/admin/stats/dashboard',
          summary: 'Daily revenue + paid bookings for the last 7/30/90 days (today included)',
        })
        .input(AdminDashboardQuerySchema)
        .output(AdminDashboardSeriesSchema),
    },
    /**
     * Outbox email (spec P4c §3-F7) — bề mặt triage cho hàng đợi email mà
     * worker drain mỗi phút (ADR-0007). Vụ Resend key 20/08 phải soi bảng
     * này bằng SQL tay; đây là lý do vùng tồn tại.
     *
     * `retry` KHÔNG gọi worker: chỉ đặt hàng FAILED về PENDING (attempts về
     * 0, GIỮ `lastError` cho tới khi worker ghi đè), lượt drain kế tự nhặt.
     * Guard `status = FAILED` nằm trên chính câu UPDATE: hàng đang PENDING/
     * SENT → 0 row → `NOT_FAILED` (409 — thế giới đã đổi dưới chân dialog);
     * id lạ → `NOT_FOUND`. Không có xoá (spec §2.4).
     *
     * Guard `AuthGuard` + `@Roles(ADMIN)` ở controller như mọi endpoint admin.
     */
    outbox: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/outbox',
          summary: 'List outbox rows (admin, paged, status/type/dedupeKey filters)',
        })
        .input(AdminOutboxListQuerySchema)
        .output(PagedSchema(OutboxRowSchema)),
      retry: oc
        .route({
          method: 'POST',
          path: '/api/admin/outbox/{id}/retry',
          summary: 'Re-queue a FAILED row (PENDING, attempts reset) for the next worker drain',
        })
        .input(AdminOutboxRetryInputSchema)
        .errors({
          NOT_FOUND: { status: 404, message: 'Outbox row not found' },
          NOT_FAILED: {
            status: 409,
            message: 'Only a FAILED outbox row can be retried',
          },
        })
        .output(OutboxRowSchema),
    },
    /**
     * Payment events (spec P4c §3-F8) — sổ sự kiện tiền Stripe/PayPal: một row
     * mỗi delivery đã verify chữ ký (`PaymentsService.beginEvent`), CỘNG một
     * row `payment.refunded` mỗi khoản hoàn ta phát ở cổng (ADR-0043). HOÀN
     * TOÀN ĐỌC: không endpoint ghi (§2.2) — kẻ duy nhất đổi row là money-path.
     *
     * `list` KHÔNG mang payload (mỗi event Stripe ~3KB JSON); drawer gọi
     * `byId` khi mở. Payload đã redact khoá credential ở mapper API (Stripe
     * `payment_intent.*` mang `client_secret`), còn PII khách (email, tên)
     * hiện nguyên — admin đã thấy ở bảng bookings (§2.3).
     *
     * Guard `AuthGuard` + `@Roles(ADMIN)` ở controller như mọi endpoint admin.
     */
    paymentEvents: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/payment-events',
          summary:
            'List payment webhook events (admin, paged, provider/type/eventId/unprocessed filters)',
        })
        .input(AdminPaymentEventsListQuerySchema)
        .output(PagedSchema(PaymentEventRowSchema)),
      byId: oc
        .route({
          method: 'GET',
          path: '/api/admin/payment-events/{id}',
          summary: 'One payment webhook event with its full provider payload',
        })
        .input(AdminPaymentEventByIdInputSchema)
        .errors({ NOT_FOUND: { status: 404, message: 'Payment event not found' } })
        .output(PaymentEventDetailSchema),
    },
    /**
     * Enquiries (spec P4c §3-F9) — CRM nhỏ trên bảng `enquiries` mà form
     * "Inquire Now" công khai ghi vào (ADR-0003), cộng thread note nội bộ.
     *
     * Vùng đầu tiên của P4c có HAI hành vi ghi, và cả hai đều để lại VẾT
     * (§2.2): `setStatus` chạy MỘT transaction "update + append
     * `enquiry_status_events`" nên "Won 28d" đếm được LƯỢT chuyển thật thay
     * vì đoán qua `updatedAt` (§2.5); `addNote` mang `authorId`/`authorName`
     * của phiên vào một thread APPEND-ONLY (không sửa, không xoá).
     *
     * Chuyển trạng thái TỰ DO giữa năm giá trị — không luật máy nào chặn
     * (CRM nhỏ, admin biết mình làm gì), nhưng dialog xác nhận phải nêu rõ
     * `from → to` trước khi bắn.
     *
     * Cả hai lệnh ghi trả kết quả GỌN, không phải detail (vòng vá review
     * F9): `setStatus` trả `{id, name, status, changed}` — `changed: false`
     * là no-op phải phân biệt được; `addNote` trả `{id}`. Trang chi tiết
     * `router.refresh()` là nguồn sự thật của màn hình, nên chở cả thread
     * note qua dây chỉ để ném đi là một lượt đọc thừa NẰM TRONG transaction.
     *
     * Guard `AuthGuard` + `@Roles(ADMIN)` ở controller như mọi endpoint admin.
     */
    enquiries: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/enquiries',
          summary: 'List enquiries (admin, paged, status/name-email/tour filters)',
        })
        .input(AdminEnquiriesListQuerySchema)
        .output(PagedSchema(EnquiryRowSchema)),
      byId: oc
        .route({
          method: 'GET',
          path: '/api/admin/enquiries/{id}',
          summary: 'One enquiry with its message, notes and status history',
        })
        .input(AdminEnquiryByIdInputSchema)
        .errors({ NOT_FOUND: { status: 404, message: 'Enquiry not found' } })
        .output(EnquiryDetailSchema),
      setStatus: oc
        .route({
          method: 'POST',
          path: '/api/admin/enquiries/{id}/status',
          summary: 'Move an enquiry to another status (appends an audit event)',
        })
        .input(AdminEnquirySetStatusInputSchema)
        .errors({ NOT_FOUND: { status: 404, message: 'Enquiry not found' } })
        .output(AdminEnquirySetStatusResultSchema),
      addNote: oc
        .route({
          method: 'POST',
          path: '/api/admin/enquiries/{id}/notes',
          summary: 'Append an internal note to the enquiry thread',
        })
        .input(AdminEnquiryAddNoteInputSchema)
        .errors({ NOT_FOUND: { status: 404, message: 'Enquiry not found' } })
        .output(AdminEnquiryAddNoteResultSchema),
    },
    /**
     * Subscribers newsletter (spec P4c §3-F10) — danh sách nhận tin mà form
     * footer CÔNG KHAI của web ghi vào, cộng MỘT hành vi ghi: gỡ một địa chỉ
     * khỏi danh sách khi chính khách nhờ (trả lời email, gọi điện) mà họ
     * không tự bấm được link trong thư.
     *
     * `unsubscribe` KHÔNG đi qua token HMAC của đường khách: token đó tồn tại
     * để chứng minh "người bấm cầm được hộp thư này" khi KHÔNG có phiên nào —
     * còn ở đây admin đã qua `AuthGuard` + `@Roles(ADMIN)`, và dòng log
     * `[admin] subscriber unsubscribe {adminId, subscriberId}` là thứ quy
     * hành vi về người. Bắt admin tự ghép token là dựng lại một cái khoá cho
     * cánh cửa đã có khoá khác.
     *
     * Guard `unsubscribedAt: null` nằm trên chính câu UPDATE (cùng khuôn
     * `outbox.retry` và `NewsletterService.unsubscribe`): 0 row + hàng còn đó
     * → `ALREADY_UNSUBSCRIBED` (409 — thế giới đã đổi dưới chân dialog, và
     * mốc rút consent CŨ không được đè); id lạ → `NOT_FOUND`.
     *
     * KHÔNG có `resubscribe` phía admin (spec §3-F10): đăng ký hộ người khác
     * là đúng thứ mà việc thiếu double opt-in khiến không kiểm chứng được —
     * consent phải đi từ link trong hộp thư của chính chủ. Không có xoá
     * (§2.4): huỷ là ghi mốc, không phải mất hàng.
     *
     * Guard `AuthGuard` + `@Roles(ADMIN)` ở controller như mọi endpoint admin.
     */
    subscribers: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/subscribers',
          summary: 'List newsletter subscribers (admin, paged, active/email/source filters)',
        })
        .input(AdminSubscribersListQuerySchema)
        .output(AdminSubscribersListResultSchema),
      unsubscribe: oc
        .route({
          method: 'POST',
          path: '/api/admin/subscribers/{id}/unsubscribe',
          summary: "Remove one address from the newsletter list on the subscriber's behalf",
        })
        .input(AdminSubscriberUnsubscribeInputSchema)
        .errors({
          NOT_FOUND: { status: 404, message: 'Subscriber not found' },
          ALREADY_UNSUBSCRIBED: {
            status: 409,
            message: 'This address has already left the newsletter list',
          },
        })
        .output(AdminSubscriberUnsubscribeResultSchema),
    },
    /**
     * Báo cáo THÁNG (spec P4b §3-F6) — nguồn của trang `/reports`, nút CSV
     * của nó và bản in PDF bằng chính trình duyệt.
     *
     * Đứng RIÊNG chứ không phải `admin.stats.*` với input `{from,to}`: lý do
     * đầy đủ ở JSDoc đầu `schemas/reports.ts` (stats là CẶP số của hai kỳ dài
     * bằng nhau — tháng thì không bằng nhau; báo cáo là tổng tuyệt đối của
     * một kỳ đóng cộng những con số stat card không có). Các câu aggregate
     * vẫn dùng chung một bản bên API (`stats-aggregates.ts`), nên định nghĩa
     * doanh thu vẫn chỉ có một.
     *
     * KHÔNG khai lỗi nghiệp vụ: tháng không có dữ liệu là một báo cáo TOÀN
     * SỐ 0, không phải 404 — "tháng 7 không bán được gì" là câu trả lời thật.
     * Guard `AuthGuard` + `@Roles(ADMIN)` ở controller như mọi endpoint admin.
     */
    reports: {
      monthly: oc
        .route({
          method: 'GET',
          path: '/api/admin/reports/monthly',
          summary: 'Revenue, bookings, refunds, cancellations and reviews for one calendar month',
        })
        .input(AdminMonthlyReportQuerySchema)
        .output(AdminMonthlyReportSchema),
    },
    /**
     * Tours phía admin (spec P4e-1 §3-F11) — bề mặt ĐỌC danh sách vận hành
     * cộng ĐÚNG MỘT công tắc: đăng / gỡ đăng. Tạo, sửa và xoá tour là P4e-3;
     * chuyến khởi hành của một tour là `admin.departures.*` (F12).
     *
     * `list` khác `catalog.tours.list` ở ba chỗ, và cả ba đều là lý do nó
     * phải là một endpoint riêng chứ không phải một cờ trên endpoint công
     * khai: nó trả CẢ tour chưa đăng (bề mặt công khai không được biết chúng
     * tồn tại), nó trả `isPublished` (thứ luôn `true` ở bề mặt kia nên không
     * có chỗ), và nó đếm chuyến còn mở theo khoảng lọc của người đang xem.
     *
     * `setPublished` CỐ Ý không khai mã lỗi nào ngoài `NOT_FOUND`. Gỡ đăng
     * một tour đang có booking sống là HỢP LỆ và không được chặn (spec
     * §3-F11): khách đã mua vẫn đi, tour chỉ thôi được chào bán. Một guard ở
     * đây sẽ khoá đúng thao tác mà vận hành cần nhất — rút một tour khỏi kệ
     * ngay khi có chuyện.
     *
     * Bust cache web (`tours` + `tour:<slug>`) gọi SAU khi transaction commit,
     * KHÔNG trong transaction — tiền lệ ở `reviews.service.ts`.
     *
     * Guard `AuthGuard` + `@Roles(ADMIN)` ở controller như mọi endpoint admin.
     */
    tours: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/tours',
          summary: 'List ALL tours (admin, paged, category/published filters + open departures)',
        })
        .input(AdminToursListQuerySchema)
        .output(PagedSchema(AdminTourRowSchema)),
      setPublished: oc
        .route({
          method: 'POST',
          path: '/api/admin/tours/{id}/published',
          summary: 'Put a tour on sale or take it off — never blocked by live bookings',
        })
        .input(AdminTourSetPublishedInputSchema)
        .errors({ NOT_FOUND: { status: 404, message: 'Tour not found' } })
        .output(AdminTourSetPublishedResultSchema),
    },
    /**
     * Chuyến khởi hành của MỘT tour (spec P4e-1 F12) — bề mặt GHI đầu tiên
     * của catalog, và là nơi lịch chạy thật sự được dựng.
     *
     * Ba lệnh ghi, ba phán quyết riêng, mỗi cái một mã để màn in đúng câu:
     *
     * - `update` từ chối **đổi ngày** khi chuyến đã có booking sống
     *   (`DEPARTURE_HAS_BOOKINGS`). `Booking` giữ BẢN SAO ngày khởi hành và
     *   ADR-0041 tính hạn huỷ từ bản sao ấy, nên đổi ngày chuyến là tạo hai
     *   sự thật — bất biến spec §2b: hạn huỷ không bao giờ xấu đi sau khi
     *   khách đã trả tiền. Sửa GIÁ và GHẾ thì vẫn được, kể cả khi có khách.
     * - `update` từ chối **hạ ghế** dưới số đã đặt (`SEATS_BELOW_BOOKED`).
     *   CHECK `departures_seats_within_total` vẫn đứng sau làm backstop,
     *   nhưng một SQLSTATE 23514 phơi lên màn hình là câu trả lời cho máy,
     *   không phải cho người đang sửa lịch (§2c).
     * - `setStatus` từ chối **mở lại** sau hạn chót (`DEADLINE_PASSED`): hạn
     *   chót cũng là lúc ngừng nhận đặt (ADR-0041 §3), nên mở lại sau mốc đó
     *   là bày ra một chuyến không ai đặt được.
     *
     * Cả hai lệnh còn từ chối động vào chuyến đã `CANCELLED`
     * (`DEPARTURE_CANCELLED`): đó là bản ghi ĐÓNG — khách của nó đã được hoàn
     * tiền theo đường F13, và sửa lại nó là đi vòng quanh chính việc ấy.
     *
     * Ba mã đều 409 chứ không 422: input hoàn toàn hợp lệ, chỉ là thế giới đã
     * đổi dưới chân dialog — và 409 là thứ nói cho UI biết nên đóng dialog và
     * đọc lại dữ liệu thay vì mời bấm lại.
     *
     * KHÔNG có `cancel` ở đây (F13) và KHÔNG có `delete`: một chuyến đã có
     * người đặt thì không xoá được mà phải huỷ có hoàn tiền, còn chuyến chưa
     * ai đặt thì `CLOSED` đã đủ — thêm một lệnh xoá là thêm một đường làm mất
     * bản ghi mà báo cáo tháng đang đếm.
     *
     * Guard `AuthGuard` + `@Roles(ADMIN)` ở controller như mọi endpoint admin.
     */
    departures: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/departures',
          summary: 'Departures of one tour (admin, paged, status filter) + the tour itself',
        })
        .input(AdminDeparturesListQuerySchema)
        .errors({ NOT_FOUND: { status: 404, message: 'Tour not found' } })
        .output(AdminDeparturesListResultSchema),
      create: oc
        .route({
          method: 'POST',
          path: '/api/admin/departures',
          summary: 'Add a departure to a tour',
        })
        .input(AdminDepartureCreateInputSchema)
        .errors({
          NOT_FOUND: { status: 404, message: 'Tour not found' },
          // Hai ca dưới là 422: input đúng hình dạng nhưng vô nghĩa về nghiệp
          // vụ, và người gõ sửa được ngay tại chỗ — khác hẳn ba mã 409 ở
          // `update`/`setStatus`, nơi thứ đã đổi nằm ngoài tầm tay họ.
          INVALID_DATE_RANGE: { status: 422, message: 'The return date is before the start date' },
          START_IN_PAST: {
            status: 422,
            message: 'A departure cannot start in the past',
          },
        })
        .output(AdminDepartureRowSchema),
      update: oc
        .route({
          method: 'POST',
          path: '/api/admin/departures/{id}',
          summary: 'Edit the dates, seats or price of one departure',
        })
        .input(AdminDepartureUpdateInputSchema)
        .errors({
          NOT_FOUND: { status: 404, message: 'Departure not found' },
          INVALID_DATE_RANGE: { status: 422, message: 'The return date is before the start date' },
          START_IN_PAST: { status: 422, message: 'A departure cannot start in the past' },
          DEPARTURE_HAS_BOOKINGS: {
            status: 409,
            message: 'This departure already has live bookings, so its dates can no longer change',
          },
          SEATS_BELOW_BOOKED: {
            status: 409,
            message: 'The seat total cannot go below the seats already booked',
          },
          DEPARTURE_CANCELLED: {
            status: 409,
            message: 'A cancelled departure can no longer be edited',
          },
        })
        .output(AdminDepartureRowSchema),
      setStatus: oc
        .route({
          method: 'POST',
          path: '/api/admin/departures/{id}/status',
          summary: 'Close a departure to new bookings, or reopen it',
        })
        .input(AdminDepartureSetStatusInputSchema)
        .errors({
          NOT_FOUND: { status: 404, message: 'Departure not found' },
          DEADLINE_PASSED: {
            status: 409,
            message: 'The booking deadline has passed, so this departure can no longer reopen',
          },
          DEPARTURE_CANCELLED: {
            status: 409,
            message: 'A cancelled departure can no longer change status',
          },
        })
        .output(AdminDepartureRowSchema),
    },
  },
};

export type ContractRouter = typeof contract;
