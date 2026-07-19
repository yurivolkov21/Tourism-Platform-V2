import { z } from 'zod';

/** Một mục trong wishlist — dữ liệu tour rút gọn kèm cờ khả dụng. */
export const WishlistItemSchema = z.object({
  tourId: z.uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  basePrice: z.string(),
  currency: z.string().length(3),
  durationDays: z.int().positive(),
  ratingAvg: z.number().min(0).max(5).nullable(),
  ratingCount: z.int().nonnegative(),
  addedAt: z.iso.datetime(),
  // Tour đã bị unpublish sau khi khách lưu. Nexora rò rỉ thẳng cột
  // `isPublished` rồi để FE tự suy diễn — hậu quả là item chết, bấm vào 404.
  // Ở đây trả cờ ngữ nghĩa để FE hiển thị "không còn khả dụng" tử tế.
  unavailable: z.boolean(),
});
export type WishlistItem = z.output<typeof WishlistItemSchema>;

/** `wished: true` thêm, `false` bỏ — một endpoint, gọi lại bao nhiêu lần cũng cùng kết quả. */
export const SetWishlistInputSchema = z.object({
  tourId: z.uuid(),
  wished: z.boolean(),
});

export const SetWishlistResultSchema = z.object({ tourId: z.uuid(), wished: z.boolean() });

/** Batch (A11): trang danh sách tour hỏi MỘT lần cho cả trang, không N+1. */
export const CheckWishlistInputSchema = z.object({
  tourIds: z.array(z.uuid()).min(1).max(100),
});

export const CheckWishlistResultSchema = z.object({
  wishedTourIds: z.array(z.uuid()),
});
