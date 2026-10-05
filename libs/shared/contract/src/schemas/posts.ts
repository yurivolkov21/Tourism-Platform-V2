import { z } from 'zod';
import { TourCardSchema } from './catalog.js';
import { PageQuerySchema } from './common.js';
import { MediaItemSchema } from './media.js';

/**
 * Blog công khai (spec §4.6, P3a-C). Card GỌN — KHÔNG có `content` (chỉ ở
 * detail, Task 5) để list nhẹ. Cover là media role `hero` (ADR-0005); PostTag
 * là taxonomy tự do (Task 6 mới có endpoint list riêng, ở đây chỉ tham chiếu).
 */

/**
 * Trần của từng field bài viết — gương cột DB (spec P4e-4 §2). MỘT bản cho card công khai lẫn
 * form admin (`admin-posts.ts` import từ đây): nâng trần một nơi mà nơi kia không theo thì
 * output validation của oRPC làm đường đọc công khai 500 với bài vừa lưu dài hơn (vòng review
 * P4e-4).
 */
export const POST_SLUG_MAX = 80;
export const POST_TITLE_MAX = 160;
export const POST_EXCERPT_MAX = 300;
/** Cột `post_tags.name` và `post_tags.slug` đều `VarChar(60)`. */
export const POST_TAG_NAME_MAX = 60;

export const PostTagRefSchema = z.object({ slug: z.string(), name: z.string() });
// `User.name` nullable trong schema (VarChar(120)?) → author.name nullable.
const PostAuthorSchema = z.object({ name: z.string().nullable(), avatarUrl: z.url().nullable() });

/** Item của list — card GỌN: KHÔNG có `content` (chỉ detail mới có). */
export const PostCardSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(POST_SLUG_MAX),
  title: z.string().min(1).max(POST_TITLE_MAX),
  excerpt: z.string().max(POST_EXCERPT_MAX).nullable(),
  publishedAt: z.iso.datetime(),
  cover: MediaItemSchema.nullable(),
  tags: z.array(PostTagRefSchema),
  author: PostAuthorSchema,
});
export type PostCard = z.output<typeof PostCardSchema>;

/** Detail — thêm content markdown, SEO meta thô (nullable), full media, related tours. */
export const PostDetailSchema = PostCardSchema.extend({
  content: z.string(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  media: z.array(MediaItemSchema),
  // Tour-summary hiện có của catalog — KHÔNG media (ADR-0005). Tái dùng
  // TourCardSchema (import ở đầu file) để một nguồn sự thật duy nhất.
  relatedTours: z.array(TourCardSchema),
});
export type PostDetail = z.output<typeof PostDetailSchema>;

/** Tag toàn cục kèm số bài published. */
export const PostTagSchema = PostTagRefSchema.extend({ count: z.int().nonnegative() });
export type PostTag = z.output<typeof PostTagSchema>;

export const PostsListQuerySchema = PageQuerySchema.extend({
  sort: z.enum(['publishedAt', 'createdAt', 'updatedAt', 'title']).default('publishedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  tag: z.string().min(1).max(POST_TAG_NAME_MAX).optional(),
  search: z.string().trim().max(POST_TITLE_MAX).optional(),
});
export type PostsListQuery = z.output<typeof PostsListQuerySchema>;
