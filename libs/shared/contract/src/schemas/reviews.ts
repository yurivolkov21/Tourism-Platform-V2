import { z } from 'zod';
import { BookingCodeSchema, PageQuerySchema } from './common.js';
import { MediaItemSchema, REVIEW_PHOTOS_MAX } from './media.js';

export const RatingSchema = z.int().min(1).max(5);

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
  photos: z.array(z.string().min(1).max(300)).max(REVIEW_PHOTOS_MAX).optional(),
});

export const ReviewsByTourQuerySchema = PageQuerySchema.extend({
  tourSlug: z.string().min(1).max(120),
});

export type PublicReview = z.infer<typeof PublicReviewSchema>;

/** Review nhìn từ phía chính khách gọi `reviews.mine` — thêm `isApproved` so
 * với `PublicReviewSchema` để khách phân biệt được review nào đang chờ duyệt
 * (đang hiện với khách nhưng CHƯA lên trang tour), tránh gửi lại và ăn
 * `REVIEW_ALREADY_EXISTS` vì tưởng nhầm là gửi chưa thành công. */
export const MyReviewSchema = PublicReviewSchema.extend({
  isApproved: z.boolean(),
  // R1: danh tính tour để trang "Đánh giá của tôi" hiện tên + link được.
  // nullable — FK tour trên schema là nullable (review curated có thể không tour).
  tourSlug: z.string().nullable(),
  tourTitle: z.string().nullable(),
});

export type MyReview = z.infer<typeof MyReviewSchema>;

/** Input duyệt/bỏ duyệt một review (admin). */
export const ModerateReviewInputSchema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

/** Review nhìn từ phía admin — thêm trạng thái duyệt + nguồn + dấu vết. */
export const AdminReviewSchema = PublicReviewSchema.extend({
  isApproved: z.boolean(),
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
  isApproved: z.boolean().optional(),
  source: z.enum(['VERIFIED', 'CURATED']).optional(),
  rating: RatingSchema.optional(),
  search: z.string().min(1).max(100).optional(),
});

export type AdminReview = z.infer<typeof AdminReviewSchema>;
