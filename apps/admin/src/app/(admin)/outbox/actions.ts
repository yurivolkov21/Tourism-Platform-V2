'use server';

import {
  type AdminOutboxRetryInput,
  AdminOutboxRetryInputSchema,
  type OutboxRow,
} from '@tourism/contract';
import { updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { retryOutboxRow } from '@/lib/api/outbox';
import { ADMIN_STATS_TAG } from '@/lib/api/stats';
import { classifyRetryError, type RetryActionResult } from '@/lib/outbox-retry';

/**
 * Hành vi GHI của vùng outbox (spec P4c §3-F7) — cùng khuôn đã chốt ở
 * `cancellations/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ một nút trong client component.
 * - Quyền KHÔNG kiểm ở đây: gác ở `AuthGuard` + `@Roles(ADMIN)` của API.
 * - Input re-parse bằng CHÍNH schema contract: hỏng thì `INVALID_INPUT`.
 * - `try` chỉ ôm ĐÚNG lời gọi; lỗi sau-commit không biến một retry đã ăn
 *   thành thông báo thất bại.
 * - KHÔNG `revalidatePath`/`refresh()` ở đây: client tự `router.refresh()`.
 */
export async function retryOutboxAction(input: AdminOutboxRetryInput): Promise<RetryActionResult> {
  const parsed = AdminOutboxRetryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: OutboxRow;
  try {
    row = await retryOutboxRow(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyRetryError(error) };
  }
  // Card Queued/Failed đổi theo lệnh ghi này.
  updateTag(ADMIN_STATS_TAG);
  return { ok: true, dedupeKey: row.dedupeKey };
}
