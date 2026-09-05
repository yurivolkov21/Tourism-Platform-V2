import { z } from 'zod';
import { BookingCodeSchema, CalendarDateSchema, PageQuerySchema } from './common.js';
import { MediaItemSchema, REVIEW_PHOTOS_MAX } from './media.js';

export const RatingSchema = z.int().min(1).max(5);

/**
 * Ba động từ moderation (ADR-0031 §3). Trước đó là một boolean `approve`, và
 * boolean ấy không phân biệt được HAI ý định khác hẳn nhau:
 *
 * - `unpublish` — gỡ xuống, CHƯA quyết. Review Ở LẠI hàng đợi.
 * - `reject` — bác bỏ, CHUNG CUỘC. Review RỜI hàng đợi, và khách được báo.
 *
 * Gộp chúng là ép người duyệt tuyên một phán quyết chung cuộc khi họ chỉ muốn
 * gỡ tạm để điều tra.
 */
export const ReviewVerdictSchema = z.enum(['approve', 'reject', 'unpublish']);

export type ReviewVerdict = z.output<typeof ReviewVerdictSchema>;

/** Ba trạng thái của một review, SUY từ hai cột (ADR-0031 §1). */
export const ReviewModerationStateSchema = z.enum(['pending', 'approved', 'rejected']);

export type ReviewModerationState = z.output<typeof ReviewModerationStateSchema>;

/** Review hiển thị công khai. KHÔNG có userId/bookingId — Zod strip field
 * không khai báo nên không thể rò rỉ, khác Nexora trả nguyên row Prisma. */
export const PublicReviewSchema = z.object({
  id: z.uuid(),
  rating: RatingSchema,
  title: z.string().nullable(),
  body: z.string(),
  /** null khi tác giả đã xoá tài khoản — FE render "Deleted account". */
  authorName: z.string().nullable(),
  authorDeleted: z.boolean(),
  createdAt: z.iso.datetime(),
  /** Ảnh chuyến đi khách đính kèm (ADR-0021) — URL đã dựng, rỗng nếu không có. */
  media: z.array(MediaItemSchema),
});

/**
 * publicId ảnh review do client gửi lên. Từ ADR-0035 chuỗi này không còn chỉ
 * là "ảnh vỡ nếu sai": khi tác giả gỡ nó khỏi review, nó thành đối số của một
 * lệnh `destroy` không hoàn tác. `startsWith(folder)` phía server không chặn
 * được `..`, nên chặn ký tự ở đây theo đúng dạng Cloudinary tự sinh: chữ, số,
 * `_ - . /`, không segment `..` (vòng vá review 05/09). `.max(300)` khớp
 * varchar(300) của MediaAsset.publicId.
 */
export const ReviewPhotoPublicIdSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[A-Za-z0-9_-]+(?:[./][A-Za-z0-9_-]+)*$/, 'Invalid photo reference');

export const CreateReviewInputSchema = z.object({
  // Tái dùng BookingCodeSchema (common.ts) thay vì lặp regex tại chỗ — nhất
  // quán với media.ts (SignUploadInputSchema nhánh REVIEW_PHOTO).
  bookingCode: BookingCodeSchema,
  rating: RatingSchema,
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(2000),
  /**
   * publicId Cloudinary đã upload xong qua media.signUpload (ADR-0021 §4) —
   * thứ tự mảng = thứ tự hiển thị (ảnh đầu là đại diện). Server kiểm mỗi
   * publicId thuộc đúng folder reviews/<bookingCode>. `.max(300)` khớp
   * varchar(300) của MediaAsset.publicId — thiếu trần này thì chuỗi dài chết
   * P2000 ở DB (500) thay vì 400 ở tầng validate.
   */
  photos: z.array(ReviewPhotoPublicIdSchema).max(REVIEW_PHOTOS_MAX).optional(),
});

/**
 * Input SỬA một review của chính mình (ADR-0032 §3).
 *
 * Cùng hình dạng NỘI DUNG với `CreateReviewInputSchema` trừ `bookingCode` —
 * booking đã cố định theo review, và cho đổi nó là cho chuyển một review sang
 * chuyến khác.
 *
 * `photos` thay TRỌN danh sách chứ không cộng thêm: một review bị bác vì tấm
 * ảnh có mặt người khác mà tác giả không gỡ được ảnh thì đường quay lại là đồ
 * giả. Vắng `photos` = không còn ảnh nào, đúng nghĩa "thay trọn".
 */
export const UpdateReviewInputSchema = z.object({
  id: z.uuid(),
  rating: RatingSchema,
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(2000),
  photos: z.array(ReviewPhotoPublicIdSchema).max(REVIEW_PHOTOS_MAX).optional(),
});

export type UpdateReviewInput = z.output<typeof UpdateReviewInputSchema>;

/** Kiểu sắp xếp modal "xem tất cả review" — key đầu (`newest`) là mặc định. */
export const ReviewSortSchema = z.enum(['newest', 'oldest', 'highest', 'lowest']);

export const ReviewsByTourQuerySchema = PageQuerySchema.extend({
  tourSlug: z.string().min(1).max(120),
  sort: ReviewSortSchema.default('newest'),
  rating: RatingSchema.optional(),
  withPhotos: z.boolean().optional(),
});

/** Số review theo từng mức sao. Khoá là chuỗi vì JSON không có khoá số. */
export const ReviewBreakdownSchema = z.object({
  '1': z.int().nonnegative(),
  '2': z.int().nonnegative(),
  '3': z.int().nonnegative(),
  '4': z.int().nonnegative(),
  '5': z.int().nonnegative(),
});
export type ReviewBreakdown = z.output<typeof ReviewBreakdownSchema>;

export type PublicReview = z.infer<typeof PublicReviewSchema>;

/** Review nhìn từ phía chính khách gọi `reviews.mine` — thêm `isApproved` so
 * với `PublicReviewSchema` để khách phân biệt được review nào đang chờ duyệt
 * (đang hiện với khách nhưng CHƯA lên trang tour), tránh gửi lại và ăn
 * `REVIEW_ALREADY_EXISTS` vì tưởng nhầm là gửi chưa thành công. */
export const MyReviewSchema = PublicReviewSchema.extend({
  isApproved: z.boolean(),
  /**
   * ADR-0031 §6: trước đây khách bị bác vẫn thấy "đang chờ duyệt" VĨNH VIỄN,
   * vì `isApproved: false` phủ cả hai ca. Nay nói thật.
   */
  moderationState: ReviewModerationStateSchema,
  /** Lý do bác, do người duyệt viết. `null` ở mọi trạng thái khác. */
  moderationNote: z.string().nullable(),
  /**
   * Số lần review này ĐÃ BỊ BÁC. Khách cần nó để biết còn sửa được không —
   * luật ở `canAuthorEdit`, và web gọi ĐÚNG hàm ấy chứ không tự so số
   * (ADR-0032 §6).
   */
  rejectionCount: z.int().nonnegative(),
  // R1: danh tính tour để trang "Đánh giá của tôi" hiện tên + link được.
  // nullable — FK tour trên schema là nullable (review curated có thể không tour).
  tourSlug: z.string().nullable(),
  tourTitle: z.string().nullable(),
});

export type MyReview = z.infer<typeof MyReviewSchema>;

/** Input duyệt / bác / gỡ đăng một review (admin). */
export const ModerateReviewInputSchema = z
  .object({
    id: z.uuid(),
    verdict: ReviewVerdictSchema,
    /**
     * Ghi chú của người duyệt. Ở nhánh `reject` nó là **LÝ DO BÁC** và đi thẳng
     * vào email cho khách (ADR-0031 §6) — trước ADR này `note` được ghi vào audit
     * trail rồi không nơi nào đọc.
     */
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((input, ctx) => {
    // ADR-0031 §7: "không có lý do thì không bác được". Bản đầu gác luật này
    // ở dialog admin (`noteRequired`) — tức mọi caller khác của endpoint bác
    // được mà không lý do, và khách nhận đúng cái mail "not published" trống
    // khối WHY mà §7 sinh ra để chặn. Gác ở contract thì admin lẫn API cùng
    // đọc một chỗ (vòng vá review 05/09).
    if (input.verdict === 'reject' && !input.note) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'A rejection needs a reason — the author reads it in the email',
      });
    }
  });

/** Review nhìn từ phía admin — thêm trạng thái duyệt + nguồn + dấu vết. */
export const AdminReviewSchema = PublicReviewSchema.extend({
  isApproved: z.boolean(),
  /**
   * Trạng thái ĐÃ SUY SẴN từ hai cột (ADR-0031 §1) — client không tự ghép
   * `isApproved` với `rejectedAt` lần thứ hai, và không thể ghép sai.
   */
  moderationState: ReviewModerationStateSchema,
  /** Lúc bị bác; `null` khi chưa từng bị bác. */
  rejectedAt: z.iso.datetime().nullable(),
  /**
   * Ghi chú của lần quyết định GẦN NHẤT, đọc từ audit trail. Ở review bị bác
   * đây là lý do — thứ dialog chi tiết hiện ra và khách nhận trong email.
   */
  moderationNote: z.string().nullable(),
  /**
   * Số lần đã bị bác. Ở màn admin nó là NGỮ CẢNH: một review `pending` với
   * `rejectionCount > 0` là bài đã bị bác rồi tác giả viết lại, và người duyệt
   * cần biết điều đó trước khi đọc (ADR-0032 §8).
   */
  rejectionCount: z.int().nonnegative(),
  source: z.enum(['VERIFIED', 'CURATED']),
  tourSlug: z.string().nullable(),
  // R2: tên tour (không chỉ slug) để admin nhận diện; ai duyệt lần cuối
  // (null khi chưa duyệt). PII khách (email/tên) CỐ Ý không phơi ở đây.
  tourTitle: z.string().nullable(),
  moderatedAt: z.iso.datetime().nullable(),
  moderatedBy: z.string().nullable(),
});

/** R2: ngoài `isApproved`, admin lọc thêm theo nguồn + số sao + free-text
 * search (body/title/tên tác giả) để soi hàng đợi moderation. */
export const AdminReviewsQuerySchema = PageQuerySchema.extend({
  /**
   * Lọc theo TRẠNG THÁI (ADR-0031 §1), thay cho `isApproved` boolean cũ: một
   * boolean chỉ chia được hai phần, mà từ nay có ba — và "chờ duyệt" giờ
   * nghĩa là CHƯA CÓ PHÁN QUYẾT, không còn là "chưa đăng".
   */
  state: ReviewModerationStateSchema.optional(),
  source: z.enum(['VERIFIED', 'CURATED']).optional(),
  rating: RatingSchema.optional(),
  search: z.string().min(1).max(100).optional(),
  /**
   * Khoảng ngày lọc theo `created_at` — ngày review được GỬI (ADR-0028
   * §AMEND 2), cùng cột bảng đang sắp xếp.
   *
   * KHÔNG lọc theo `moderated_at` dù nó khớp tuyệt đối với card Approved:
   * review chưa duyệt có `moderated_at` null, nên lọc cột ấy sẽ quét sạch
   * hàng đợi khỏi bảng — tức xoá mất lý do tồn tại của trang.
   *
   * Bỏ trống cả hai = KHÔNG lọc ngày, và đó là MẶC ĐỊNH của vùng (giống
   * `/cancellations`, khác `/bookings`): đây là hàng đợi việc phải làm, mở
   * trang ra phải thấy đủ mọi review đang chờ kể cả cái gửi từ tháng trước.
   * Vì URL trần chính là "xem tất cả" nên ở đây KHÔNG có sentinel `?dates=all`.
   */
  from: CalendarDateSchema.optional(),
  to: CalendarDateSchema.optional(),
})
  // `.refine` giữ nguyên `.shape` của ZodObject (điều kiện sống còn của
  // `ZodSmartCoercionPlugin` bên API) — xem ghi chú ở `AdminBookingsListQuerySchema`.
  .refine(({ from, to }) => !(from && to) || from <= to, {
    message: 'from must be on or before to',
    path: ['to'],
  });

export type AdminReview = z.infer<typeof AdminReviewSchema>;

/** Input của `admin.reviews.moderate` — server action admin re-parse bằng
 * CHÍNH schema này trước khi gửi, nên cần kiểu tường minh (cùng nếp
 * `AdminRefundInput`/`DecideCancellationInput` của bookings.ts). */
export type ModerateReviewInput = z.output<typeof ModerateReviewInputSchema>;
