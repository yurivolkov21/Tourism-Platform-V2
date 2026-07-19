import { z } from 'zod';
import { PageQuerySchema } from './common.js';

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
});

export const CreateReviewInputSchema = z.object({
  bookingCode: z.string().regex(/^BK-[A-Z0-9]{8}$/),
  rating: RatingSchema,
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(2000),
});

export const ReviewsByTourQuerySchema = PageQuerySchema.extend({
  tourSlug: z.string().min(1).max(120),
});

export type PublicReview = z.infer<typeof PublicReviewSchema>;

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
  moderatedAt: z.iso.datetime().nullable(),
});

export const AdminReviewsQuerySchema = PageQuerySchema.extend({
  isApproved: z.boolean().optional(),
});

export type AdminReview = z.infer<typeof AdminReviewSchema>;
