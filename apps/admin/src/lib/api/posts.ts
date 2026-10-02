import { isDefinedError, safe } from '@orpc/client';
import {
  type AdminPostCreateInput,
  type AdminPostCreateResult,
  type AdminPostDetail,
  AdminPostGetInputSchema,
  type AdminPostRow,
  type AdminPostSignCoverUploadInput,
  type AdminPostUpdateInput,
  type Paged,
  type SignedUploadParams,
} from '@tourism/contract';
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
