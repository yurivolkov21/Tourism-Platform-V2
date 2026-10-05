import { z } from 'zod';
import { TourPhotoUploadSchema } from './admin-tours.js';
import { AdminPageQuerySchema, descriptionSchema } from './common.js';
import { MediaPublicIdSchema } from './media.js';
import { slugifyVietnamese, slugSchema } from './slug.js';

/**
 * Quản trị bài viết (spec P4e-4, ADR-0051) — bảy thao tác của `admin.posts.*` cộng ba
 * hàm thuần mà API và admin cùng gọi: trạng thái hiển thị, độ đủ để đăng, luật nội dung.
 * Một bản cho cả hai đầu nên form không thể cho qua thứ server sẽ chặn.
 *
 * Trần của từng field gương cột DB (spec §2). Export để admin đếm ký tự bằng CHÍNH các
 * con số này.
 */
export const POST_SLUG_MAX = 80;
export const POST_TITLE_MAX = 160;
export const POST_EXCERPT_MAX = 300;
/** Bài seed dài nhất chưa tới 5000 ký tự; trần chặn dán nhầm cả một file. */
export const POST_CONTENT_MAX = 20_000;
export const POST_TAGS_MAX = 5;
/** Cột `post_tags.name` và `post_tags.slug` đều `VarChar(60)`. */
export const POST_TAG_NAME_MAX = 60;
export const POST_RELATED_TOURS_MAX = 3;
/** Cột `media_assets.alt VarChar(300)` — cùng cột với alt của ảnh tour. */
export const POST_COVER_ALT_MAX = 300;

/** Phiên bản = `updatedAt` dạng ISO có mili-giây (ADR-0051 §2, khuôn ADR-0047 §3). */
const VersionSchema = z.iso.datetime();
const TitleSchema = z.string().trim().min(1).max(POST_TITLE_MAX);

export const PostSlugSchema = slugSchema(POST_SLUG_MAX);

/** Hai giá trị lưu ở DB. Lịch hẹn nằm ở `publishedAt`, không ở đây (ADR-0051 §3). */
export const PostStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);
export type PostStatus = z.output<typeof PostStatusSchema>;

/** Ba trạng thái HIỂN THỊ của admin — suy ra, không lưu. */
export const PostDisplayStatusSchema = z.enum(['draft', 'scheduled', 'published']);
export type PostDisplayStatus = z.output<typeof PostDisplayStatusSchema>;

/**
 * Trạng thái hiển thị — MỘT hàm cho chip của admin và bộ lọc của API (spec §2.2).
 *
 * PUBLISHED mà thiếu `publishedAt` là `draft`: web không hiện bài ấy
 * (`publishedPostWhere` đòi `publishedAt <= now`), nên gọi nó "đã đăng" là nói sai. Đường
 * ghi không tạo được trạng thái ấy (refine của `AdminPostUpdateInputSchema`); nó chỉ có
 * khi ai đó sửa tay DB.
 */
export function postDisplayStatus(
  status: PostStatus,
  publishedAt: string | null,
  now: Date,
): PostDisplayStatus {
  if (status === 'DRAFT' || publishedAt === null) return 'draft';
  return Date.parse(publishedAt) > now.getTime() ? 'scheduled' : 'published';
}

/** Ba thứ card trên `/blog` và trang chủ cần (ADR-0051 §4), theo thứ tự form bày. */
export const PostReadinessItemSchema = z.enum(['content', 'excerpt', 'cover']);
export type PostReadinessItem = z.output<typeof PostReadinessItemSchema>;

/** Các mục CÒN THIẾU để đăng — rỗng là đủ. Chỉ có khoảng trắng tính là chưa viết. */
export function postReadiness(post: {
  content: string;
  excerpt: string | null;
  hasCover: boolean;
}): PostReadinessItem[] {
  const missing: PostReadinessItem[] = [];
  if (post.content.trim() === '') missing.push('content');
  if ((post.excerpt ?? '').trim() === '') missing.push('excerpt');
  if (!post.hasCover) missing.push('cover');
  return missing;
}

/**
 * Ảnh nhúng — ngoài phạm vi (spec §2.4): cần CSP, vòng đời media, parser mobile. Bắt MỌI
 * `![`: ngoài `![alt](url)` còn ảnh dạng tham chiếu (`![a][r]`), dạng tắt (`![r]`), alt lồng
 * ngoặc hay có ngoặc thoát — regex cũ chỉ bắt dạng đầu, lại chạy thời gian bình phương trên
 * chuỗi nhiều `![` (vòng review P4e-4). Giờ là một lượt quét tuyến tính; bắt cả trong khối
 * code, cùng luật với HTML thô bên dưới.
 */
const EMBEDDED_IMAGE = /!\[/;
/**
 * Thẻ HTML thô: `<tên …>`, `</tên>`, `<tên/>` và chú thích `<!--`. Tên thẻ phải mở đầu
 * bằng chữ cái nên "a < b" và "<3" lọt qua; autolink `<https://…>` cũng lọt, vì sau tên
 * thẻ chỉ được là khoảng trắng, `/` hay `>`. Bắt cả trong khối code — bài du lịch không có
 * code, luật đơn giản đáng hơn một parser.
 */
const RAW_HTML = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>|<!--/;

export type PostContentIssue = 'image' | 'html';

/** Chỗ sai ĐẦU TIÊN của thân bài, hoặc `null`. Form admin và refine của contract cùng gọi. */
export function postContentIssue(content: string): PostContentIssue | null {
  if (EMBEDDED_IMAGE.test(content)) return 'image';
  if (RAW_HTML.test(content)) return 'html';
  return null;
}

export const PostContentSchema = z
  .string()
  // `abort`: Zod 4 mặc định vẫn chạy refine sau lỗi `max`, nên chuỗi dán nhầm cả file bị
  // quét thêm hai lượt cho một lời từ chối đã chắc.
  .max(POST_CONTENT_MAX, { abort: true })
  .refine((content) => postContentIssue(content) !== 'image', {
    message: 'images inside the post body are not supported',
  })
  .refine((content) => postContentIssue(content) !== 'html', {
    message: 'raw HTML is not allowed in the post body',
  });

/**
 * Chuẩn hoá danh sách tên tag (spec §2.5): trim, slug sinh bằng `slugifyVietnamese`, bỏ
 * trùng THEO SLUG và giữ lần đầu — "Hội An" và "Hoi An" là một tag. Tên rỗng hay chỉ có
 * ký hiệu (slug rỗng) bị bỏ; schema đã từ chối chúng trước khi tới API.
 */
export function normalizePostTags(names: readonly string[]): { slug: string; name: string }[] {
  const seen = new Set<string>();
  const tags: { slug: string; name: string }[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const slug = slugifyVietnamese(name, POST_TAG_NAME_MAX);
    if (slug === '' || seen.has(slug)) continue;
    seen.add(slug);
    tags.push({ slug, name });
  }
  return tags;
}

const PostTagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(POST_TAG_NAME_MAX)
  .refine((name) => slugifyVietnamese(name, POST_TAG_NAME_MAX) !== '', {
    message: 'a tag needs at least one letter or digit',
  });

const PostTagRefSchema = z.object({ slug: z.string(), name: z.string() });

// ── Đọc ─────────────────────────────────────────────────────────────────────

export const AdminPostStatusFilterSchema = z.enum(['all', 'published', 'scheduled', 'draft']);
export type AdminPostStatusFilter = z.output<typeof AdminPostStatusFilterSchema>;

/** Phân trang dùng chung `AdminPageQuerySchema` (`page`/`limit`) như mọi bảng admin. */
export const AdminPostsListQuerySchema = AdminPageQuerySchema.extend({
  status: AdminPostStatusFilterSchema.default('all'),
  /** Tìm theo tiêu đề, không phân biệt hoa thường. */
  search: z.string().trim().max(POST_TITLE_MAX).optional(),
});
export type AdminPostsListQuery = z.output<typeof AdminPostsListQuerySchema>;

export const AdminPostRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status: PostStatusSchema,
  publishedAt: z.iso.datetime().nullable(),
  displayStatus: PostDisplayStatusSchema,
  coverUrl: z.url().nullable(),
  tags: z.array(PostTagRefSchema),
  updatedAt: z.iso.datetime(),
});
export type AdminPostRow = z.output<typeof AdminPostRowSchema>;

/**
 * Nguồn của ảnh bìa — như ảnh tour (ADR-0048 AMEND 1): `UPLOAD` là thư mục tải lên của
 * chính bài, `LIBRARY` là ảnh có dòng thư viện địa danh, `CATALOG` là ảnh còn lại (ảnh bìa
 * của bài seed) — gỡ ra thì không chọn lại được.
 */
export const PostCoverSourceSchema = z.enum(['UPLOAD', 'LIBRARY', 'CATALOG']);
export type PostCoverSource = z.output<typeof PostCoverSourceSchema>;

export const AdminPostDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  content: z.string(),
  status: PostStatusSchema,
  publishedAt: z.iso.datetime().nullable(),
  displayStatus: PostDisplayStatusSchema,
  /** Các mục còn thiếu để đăng (`postReadiness`) — rỗng là đủ. */
  readiness: z.array(PostReadinessItemSchema),
  tags: z.array(PostTagRefSchema),
  /** Theo thứ tự lưu (`post_tours.order`); có cả tour đang tắt bán. */
  relatedTours: z.array(
    z.object({ id: z.uuid(), slug: z.string(), title: z.string(), isPublished: z.boolean() }),
  ),
  cover: z
    .object({
      publicId: z.string(),
      url: z.url(),
      alt: z.string().nullable(),
      source: PostCoverSourceSchema,
    })
    .nullable(),
  /** `posts.author_id` NOT NULL, khoá ngoại `Restrict` — tác giả luôn có, chỉ tên có thể trống. */
  author: z.object({ name: z.string().nullable() }),
  version: VersionSchema,
  createdAt: z.iso.datetime(),
});
export type AdminPostDetail = z.output<typeof AdminPostDetailSchema>;

export const AdminPostGetInputSchema = z.object({ slug: z.string().min(1).max(POST_SLUG_MAX) });
export type AdminPostGetInput = z.output<typeof AdminPostGetInputSchema>;

/** Một tag kèm số bài dùng nó, CẢ nháp — nguồn gợi ý của ô Tags. */
export const AdminPostTagSchema = PostTagRefSchema.extend({ count: z.int().nonnegative() });
export type AdminPostTag = z.output<typeof AdminPostTagSchema>;

// ── Ghi ─────────────────────────────────────────────────────────────────────

/** Hộp New post (spec §4.3) — bài sinh ra là nháp, thân bài rỗng. */
export const AdminPostCreateInputSchema = z.object({ title: TitleSchema, slug: PostSlugSchema });
export type AdminPostCreateInput = z.output<typeof AdminPostCreateInputSchema>;

export const AdminPostCreateResultSchema = z.object({ id: z.uuid(), slug: z.string() });
export type AdminPostCreateResult = z.output<typeof AdminPostCreateResultSchema>;

export const AdminPostCoverInputSchema = z.object({
  publicId: MediaPublicIdSchema,
  /** Tuỳ chọn: trống là ảnh trang trí — web vẽ `alt=""`, tiêu đề bài in ngay cạnh ảnh. */
  alt: descriptionSchema(POST_COVER_ALT_MAX),
  /** Metadata Cloudinary của ảnh MỚI tải (ADR-0048 §5) — cùng hình với ảnh tour. */
  upload: TourPhotoUploadSchema.optional(),
});
export type AdminPostCoverInput = z.output<typeof AdminPostCoverInputSchema>;

/**
 * MỘT lệnh cho cả form (spec §3.2): tag, tour liên quan và ảnh bìa thay trọn. Không có
 * `slug` — slug đặt một lần lúc tạo (ADR-0051 §2); Zod bỏ field lạ nên gửi thừa cũng không
 * đổi được gì.
 */
export const AdminPostUpdateInputSchema = z
  .object({
    id: z.uuid(),
    version: VersionSchema,
    title: TitleSchema,
    excerpt: descriptionSchema(POST_EXCERPT_MAX),
    content: PostContentSchema,
    status: PostStatusSchema,
    publishedAt: z.iso.datetime().nullable(),
    tags: z.array(PostTagNameSchema).max(POST_TAGS_MAX),
    relatedTourIds: z
      .array(z.uuid())
      .max(POST_RELATED_TOURS_MAX)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'a tour can only be listed once',
      }),
    cover: AdminPostCoverInputSchema.nullable(),
  })
  .refine((input) => input.status === 'DRAFT' || input.publishedAt !== null, {
    message: 'a published post needs a publish date',
    path: ['publishedAt'],
  });
export type AdminPostUpdateInput = z.output<typeof AdminPostUpdateInputSchema>;

export const AdminPostDeleteInputSchema = z.object({ id: z.uuid(), version: VersionSchema });
export type AdminPostDeleteInput = z.output<typeof AdminPostDeleteInputSchema>;

export const AdminPostDeleteResultSchema = z.object({ slug: z.string() });
export type AdminPostDeleteResult = z.output<typeof AdminPostDeleteResultSchema>;

export const AdminPostSignCoverUploadInputSchema = z.object({ id: z.uuid() });
export type AdminPostSignCoverUploadInput = z.output<typeof AdminPostSignCoverUploadInputSchema>;
