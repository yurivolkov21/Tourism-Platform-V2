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
