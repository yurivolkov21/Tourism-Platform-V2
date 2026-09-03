'use server';

import {
  type AdminSubscriberUnsubscribeInput,
  AdminSubscriberUnsubscribeInputSchema,
  type AdminSubscriberUnsubscribeResult,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { unsubscribeAdminSubscriber } from '@/lib/api/subscribers';
import {
  classifyUnsubscribeError,
  type UnsubscribeActionResult,
} from '@/lib/subscribers-unsubscribe';

/**
 * Hành vi GHI của vùng subscribers (spec P4c §3-F10) — cùng khuôn đã chốt ở
 * `outbox/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ một nút trong client component.
 * - Quyền KHÔNG kiểm ở đây: gác ở `AuthGuard` + `@Roles(ADMIN)` của API.
 * - Input re-parse bằng CHÍNH schema contract: hỏng thì `INVALID_INPUT`.
 * - `try` chỉ ôm ĐÚNG lời gọi; lỗi sau-commit không biến một địa chỉ đã được
 *   gỡ thành thông báo thất bại.
 * - KHÔNG `revalidatePath`/`refresh()` ở đây: client tự `router.refresh()`.
 * - KHÔNG `updateTag(ADMIN_STATS_TAG)`: stats vùng này không cache (form
 *   footer công khai và link HMAC trong email khách cũng ghi bảng này), nên
 *   `router.refresh()` của client kéo cả card lẫn bảng tươi cùng lúc.
 */
export async function unsubscribeSubscriberAction(
  input: AdminSubscriberUnsubscribeInput,
): Promise<UnsubscribeActionResult> {
  const parsed = AdminSubscriberUnsubscribeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let result: AdminSubscriberUnsubscribeResult;
  try {
    result = await unsubscribeAdminSubscriber(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyUnsubscribeError(error) };
  }
  return { ok: true, unsubscribedAt: result.unsubscribedAt };
}
