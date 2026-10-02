'use server';

import {
  type AdminPostCreateInput,
  AdminPostCreateInputSchema,
  type AdminPostCreateResult,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { createAdminPost } from '@/lib/api/posts';
import { type CreatePostResult, classifyCreatePostError } from '@/lib/posts-write';

/**
 * Hành vi GHI của trang `/posts` — cùng khuôn `tours/actions.ts`: re-parse bằng CHÍNH
 * schema contract (hỏng là `INVALID_INPUT`), `cookies()` gọi ngoài `try`, `try` chỉ ôm
 * đúng lời gọi API. Quyền gác ở `AuthGuard` + `@Roles(ADMIN)` của API. Client tự điều
 * hướng vào trang sửa của bài mới.
 */
export async function createPostAction(input: AdminPostCreateInput): Promise<CreatePostResult> {
  const parsed = AdminPostCreateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let created: AdminPostCreateResult;
  try {
    created = await createAdminPost(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyCreatePostError(error) };
  }
  return { ok: true, created };
}
