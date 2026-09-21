'use server';

import {
  type AdminTourSetPublishedInput,
  AdminTourSetPublishedInputSchema,
  type AdminTourSetPublishedResult,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { setAdminTourPublished } from '@/lib/api/tours';
import { classifySetPublishedError, type SetPublishedActionResult } from '@/lib/tours-publish';

/**
 * Hành vi GHI của vùng tours (spec P4e-1 §3-F11) — cùng khuôn đã chốt ở
 * `subscribers/actions.ts` và `outbox/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ một công tắc trong client component.
 * - Quyền KHÔNG kiểm ở đây: gác ở `AuthGuard` + `@Roles(ADMIN)` của API.
 * - Input re-parse bằng CHÍNH schema contract: hỏng thì `INVALID_INPUT`.
 * - `try` chỉ ôm ĐÚNG lời gọi; lỗi sau-commit không biến một tour đã được gỡ
 *   đăng thành thông báo thất bại.
 * - KHÔNG `revalidatePath`/`refresh()` ở đây: client tự `router.refresh()`.
 *
 * Bust cache WEB là việc của API (sau commit, chỉ khi đổi thật) — không phải
 * của action này: action chỉ nói chuyện với back-office.
 */
export async function setTourPublishedAction(
  input: AdminTourSetPublishedInput,
): Promise<SetPublishedActionResult> {
  const parsed = AdminTourSetPublishedInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let result: AdminTourSetPublishedResult;
  try {
    result = await setAdminTourPublished(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifySetPublishedError(error) };
  }
  // Trả trạng thái SERVER vừa ghi (không phải cái client vừa bấm): công tắc
  // settle theo response nên một lệnh về muộn không để lại hình ảnh sai.
  return { ok: true, isPublished: result.isPublished, changed: result.changed };
}
