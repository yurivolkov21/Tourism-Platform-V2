'use server';

import {
  type AdminDepartureCreateInput,
  AdminDepartureCreateInputSchema,
  type AdminDepartureRow,
  type AdminDepartureSetStatusInput,
  AdminDepartureSetStatusInputSchema,
  type AdminDepartureUpdateInput,
  AdminDepartureUpdateInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import {
  createAdminDeparture,
  setAdminDepartureStatus,
  updateAdminDeparture,
} from '@/lib/api/departures';
import {
  type CreateContractCode,
  classifyCreateError,
  classifySetStatusError,
  classifyUpdateError,
  type DepartureWriteResult,
  type SetStatusContractCode,
  type UpdateContractCode,
} from '@/lib/departures-write';

/**
 * BA hành vi ghi của vùng chuyến (spec P4e-1 F12) — cùng khuôn đã chốt ở
 * `enquiries/[id]/actions.ts` và `outbox/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ một dialog client.
 * - Quyền KHÔNG kiểm ở đây: server action là một endpoint POST mở như mọi
 *   endpoint khác, nên gác ở `AuthGuard` + `@Roles(ADMIN)` của API — nơi duy
 *   nhất đáng tin, đọc chính cookie được forward.
 * - Input re-parse bằng CHÍNH schema contract TRƯỚC khi đi: input hỏng ra mã
 *   `INVALID_INPUT` chứ không phải một câu GENERIC mập mờ. Đây cũng là chốt
 *   cuối chặn `status: 'CANCELLED'` — schema không nhận nó, nên kể cả một
 *   client bị sửa cũng không mở được cửa hậu ấy.
 * - `cookies()` gọi NGOÀI `try`, và `try` chỉ ôm ĐÚNG lời gọi API: một lỗi
 *   sau-commit không được phép biến một lệnh ghi đã ăn thành thông báo hỏng.
 * - KHÔNG `revalidatePath`/`refresh()` ở đây: trang là server component ĐỘNG
 *   (đọc `cookies()`), không có bản cache nào để huỷ — thứ vẽ lại nó là
 *   `router.refresh()` mà client gọi SAU khi đã báo xong cho admin. Cache của
 *   WEB thì do API tự bust sau commit (ADR-0016 §3).
 */

export async function createDepartureAction(
  input: AdminDepartureCreateInput,
): Promise<DepartureWriteResult<CreateContractCode>> {
  const parsed = AdminDepartureCreateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminDepartureRow;
  try {
    row = await createAdminDeparture(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action (Next che lỗi server ở
    // production thành digest trống) — phân loại tại đây, trả mã trần xuống.
    return { ok: false, code: classifyCreateError(error) };
  }
  return { ok: true, row };
}

export async function updateDepartureAction(
  input: AdminDepartureUpdateInput,
): Promise<DepartureWriteResult<UpdateContractCode>> {
  const parsed = AdminDepartureUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminDepartureRow;
  try {
    row = await updateAdminDeparture(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyUpdateError(error) };
  }
  return { ok: true, row };
}

export async function setDepartureStatusAction(
  input: AdminDepartureSetStatusInput,
): Promise<DepartureWriteResult<SetStatusContractCode>> {
  const parsed = AdminDepartureSetStatusInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminDepartureRow;
  try {
    row = await setAdminDepartureStatus(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySetStatusError(error) };
  }
  // Trạng thái đọc từ RESPONSE, không từ input đã gửi — toast kể đúng chuyện
  // server vừa làm.
  return { ok: true, row };
}
