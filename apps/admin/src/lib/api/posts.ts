import type {
  AdminPostCreateInput,
  AdminPostCreateResult,
  AdminPostRow,
  Paged,
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
