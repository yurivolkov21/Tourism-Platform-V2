import { isDefinedError, safe } from '@orpc/client';
import {
  type AdminPostCreateInput,
  type AdminPostCreateResult,
  type AdminPostDeleteInput,
  type AdminPostDeleteResult,
  type AdminPostDetail,
  AdminPostGetInputSchema,
  type AdminPostRow,
  type AdminPostSignCoverUploadInput,
  type AdminPostTag,
  type AdminPostUpdateInput,
  type Paged,
  type SignedUploadParams,
} from '@tourism/contract';
import type { PostTourOption } from '@/lib/post-form';
import { type PostsQuery, toPostsListInput } from '@/lib/posts-query';
import { api, withAdminAuth } from './client';

/**
 * Các đường của vùng bài viết — bọc mỏng `admin.posts.*` (spec P4e-4 §3). KHÔNG nuốt lỗi
 * ở đường ghi: mã contract phải tới server action nguyên vẹn để đổi thành mã UI.
 *
 * KHÔNG cache: bài đổi ngay dưới tay admin, `router.refresh()` sau mỗi lần lưu phải kéo
 * về sự thật mới.
 */

/** Một trang bài; input là kết quả `parsePostsSearchParams`, tức đã clamp. */
export async function fetchAdminPosts(
  cookie: string,
  query: PostsQuery,
): Promise<Paged<AdminPostRow>> {
  return api.admin.posts.list(toPostsListInput(query), { context: withAdminAuth(cookie) });
}

export async function createAdminPost(
  cookie: string,
  input: AdminPostCreateInput,
): Promise<AdminPostCreateResult> {
  return api.admin.posts.create(input, { context: withAdminAuth(cookie) });
}

/**
 * Một bài cho trang sửa; `null` khi slug không có (trang gọi `notFound()`). Slug sai hình
 * dạng của contract cũng `null`, không gọi API — khuôn `fetchAdminTour` (vòng review F17):
 * URL rác thành 404 chứ không thành trang lỗi của app.
 */
export async function fetchAdminPost(
  cookie: string,
  slug: string,
): Promise<AdminPostDetail | null> {
  if (!AdminPostGetInputSchema.safeParse({ slug }).success) return null;
  const [error, data] = await safe(
    api.admin.posts.get({ slug }, { context: withAdminAuth(cookie) }),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

export async function updateAdminPost(
  cookie: string,
  input: AdminPostUpdateInput,
): Promise<AdminPostDetail> {
  return api.admin.posts.update(input, { context: withAdminAuth(cookie) });
}

/** Ký một lượt tải ảnh bìa — bộ tham số cho TRÌNH DUYỆT POST thẳng lên Cloudinary. */
export async function signAdminPostCoverUpload(
  cookie: string,
  input: AdminPostSignCoverUploadInput,
): Promise<SignedUploadParams> {
  return api.admin.posts.signCoverUpload(input, { context: withAdminAuth(cookie) });
}

/**
 * Gợi ý của ô Tags — hỏng thì RỖNG: mất gợi ý là phiền, mất trang sửa là hỏng việc. Không
 * có gợi ý thì admin vẫn gõ được tag mới.
 */
export async function fetchPostTagOptions(cookie: string): Promise<AdminPostTag[]> {
  return api.admin.posts
    .tags(undefined, { context: withAdminAuth(cookie) })
    .catch(() => [] as AdminPostTag[]);
}

/** Trang 100 dòng (trần `limit` của contract), tối đa 10 trang = 1000 tour. */
const TOUR_OPTION_PAGE_SIZE = 100;
const TOUR_OPTION_PAGES_MAX = 10;

/**
 * MỌI tour, cả tắt bán, cho ô chọn tour liên quan (Quyết định 1): danh sách tour của admin
 * không có ô tìm, nên nạp một lần rồi lọc ở trình duyệt — 29 tour là một lượt gọi. Bỏ trùng
 * theo id (phân trang offset trôi khi có tour mới chen vào).
 *
 * KHÔNG nuốt lỗi — cùng luật `fetchTourEditorOptions`: trang sửa thiếu danh sách thì trang
 * lỗi của app, không phải một ô chọn lặng lẽ rỗng.
 */
export async function fetchPostTourOptions(cookie: string): Promise<PostTourOption[]> {
  const context = { context: withAdminAuth(cookie) };
  const options = new Map<string, PostTourOption>();
  for (let page = 1; page <= TOUR_OPTION_PAGES_MAX; page += 1) {
    const result = await api.admin.tours.list({ page, limit: TOUR_OPTION_PAGE_SIZE }, context);
    for (const row of result.items) {
      options.set(row.id, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        isPublished: row.isPublished,
      });
    }
    if (page >= result.totalPages) break;
  }
  return [...options.values()];
}

export async function deleteAdminPost(
  cookie: string,
  input: AdminPostDeleteInput,
): Promise<AdminPostDeleteResult> {
  return api.admin.posts.delete(input, { context: withAdminAuth(cookie) });
}
