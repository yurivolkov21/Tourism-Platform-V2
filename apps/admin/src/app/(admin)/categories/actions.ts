'use server';

import {
  type AdminCategoryCreateInput,
  AdminCategoryCreateInputSchema,
  type AdminCategoryMoveInput,
  AdminCategoryMoveInputSchema,
  type AdminCategoryRow,
  type AdminCategorySetActiveInput,
  AdminCategorySetActiveInputSchema,
  type AdminCategoryUpdateInput,
  AdminCategoryUpdateInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import {
  createAdminCategory,
  moveAdminCategory,
  setAdminCategoryActive,
  updateAdminCategory,
} from '@/lib/api/categories';
import {
  type CategoryListResult,
  type CategoryWriteResult,
  type CreateContractCode,
  classifyCreateError,
  classifyMoveError,
  classifySetActiveError,
  classifyUpdateError,
  type MoveContractCode,
  type SetActiveContractCode,
  type UpdateContractCode,
} from '@/lib/categories-write';

/**
 * BỐN hành vi ghi của vùng danh mục (spec P4e-2 F14) — cùng khuôn đã chốt ở
 * `tours/[slug]/departures/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ một dialog client.
 * - Quyền KHÔNG kiểm ở đây: server action là một endpoint POST mở như mọi
 *   endpoint khác, nên gác ở `AuthGuard` + `@Roles(ADMIN)` của API.
 * - Input re-parse bằng CHÍNH schema contract TRƯỚC khi đi: input hỏng ra mã
 *   `INVALID_INPUT` chứ không phải một câu GENERIC mập mờ. Đây cũng là chốt
 *   cuối chặn `slug` lọt vào lệnh sửa — schema không khai nó.
 * - `cookies()` gọi NGOÀI `try`, và `try` chỉ ôm ĐÚNG lời gọi API.
 * - KHÔNG `revalidatePath` ở đây: trang là server component ĐỘNG (đọc
 *   `cookies()`). Cache của WEB thì do API tự bust sau commit (ADR-0016 §3).
 */

export async function createCategoryAction(
  input: AdminCategoryCreateInput,
): Promise<CategoryWriteResult<CreateContractCode>> {
  const parsed = AdminCategoryCreateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminCategoryRow;
  try {
    row = await createAdminCategory(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action (Next che lỗi server ở
    // production thành digest trống) — phân loại tại đây, trả mã trần xuống.
    return { ok: false, code: classifyCreateError(error) };
  }
  return { ok: true, row };
}

export async function updateCategoryAction(
  input: AdminCategoryUpdateInput,
): Promise<CategoryWriteResult<UpdateContractCode>> {
  const parsed = AdminCategoryUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminCategoryRow;
  try {
    row = await updateAdminCategory(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyUpdateError(error) };
  }
  return { ok: true, row };
}

export async function setCategoryActiveAction(
  input: AdminCategorySetActiveInput,
): Promise<CategoryWriteResult<SetActiveContractCode>> {
  const parsed = AdminCategorySetActiveInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminCategoryRow;
  try {
    row = await setAdminCategoryActive(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySetActiveError(error) };
  }
  // Trạng thái đọc từ RESPONSE, không từ input đã gửi.
  return { ok: true, row };
}

export async function moveCategoryAction(
  input: AdminCategoryMoveInput,
): Promise<CategoryListResult<MoveContractCode>> {
  const parsed = AdminCategoryMoveInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let rows: AdminCategoryRow[];
  try {
    rows = await moveAdminCategory(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyMoveError(error) };
  }
  return { ok: true, rows };
}
