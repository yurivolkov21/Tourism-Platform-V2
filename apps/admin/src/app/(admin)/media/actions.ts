'use server';

import {
  type AdminMediaItem,
  type AdminMediaUpdateInput,
  AdminMediaUpdateInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { updateAdminMedia } from '@/lib/api/media';
import { classifyMediaError, type UpdateMediaResult } from '@/lib/media-write';

/**
 * Hành vi GHI của `/media` (ADR-0060) — cùng khuôn `appearance/actions.ts`: re-parse bằng CHÍNH
 * schema contract (hỏng là `INVALID_INPUT`), `cookies()` gọi ngoài `try`, `try` chỉ ôm đúng lời gọi
 * API. KHÔNG `revalidatePath`: client tự `router.refresh()`; cache WEB do API tự bust tag của mọi
 * chủ có dòng vừa đổi sau commit.
 */
export async function updateMediaAction(input: AdminMediaUpdateInput): Promise<UpdateMediaResult> {
  const parsed = AdminMediaUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let item: AdminMediaItem;
  try {
    item = await updateAdminMedia(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyMediaError(error) };
  }
  return { ok: true, item };
}
