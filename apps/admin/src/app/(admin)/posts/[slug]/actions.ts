'use server';

import {
  type AdminPostDetail,
  type AdminPostUpdateInput,
  AdminPostUpdateInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { updateAdminPost } from '@/lib/api/posts';
import { classifyUpdatePostError, type UpdatePostResult } from '@/lib/posts-write';

/**
 * Hành vi GHI của trang sửa bài (spec P4e-4 §4.4) — cùng khuôn
 * `tours/[slug]/actions.ts`: re-parse bằng CHÍNH schema contract (hỏng là `INVALID_INPUT`),
 * `cookies()` gọi ngoài `try`, `try` chỉ ôm đúng lời gọi API. KHÔNG `revalidatePath`: client
 * tự `router.refresh()`; cache WEB do API tự bust sau commit.
 */
export async function updatePostAction(input: AdminPostUpdateInput): Promise<UpdatePostResult> {
  const parsed = AdminPostUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminPostDetail;
  try {
    detail = await updateAdminPost(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyUpdatePostError(error) };
  }
  return { ok: true, detail };
}
