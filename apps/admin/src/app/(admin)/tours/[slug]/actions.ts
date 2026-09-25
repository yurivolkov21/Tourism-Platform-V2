'use server';

import {
  type AdminTourDeleteInput,
  AdminTourDeleteInputSchema,
  type AdminTourDeleteResult,
  type AdminTourDetail,
  type AdminTourDetailsInput,
  AdminTourDetailsInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { deleteAdminTour, updateAdminTourDetails } from '@/lib/api/tours';
import {
  classifyDeleteTourError,
  classifyDetailsError,
  type DeleteTourResult,
  type DetailsContractCode,
  type EditorWriteResult,
} from '@/lib/tour-editor-write';

/**
 * Hành vi GHI của khu làm việc tour (spec F17) — cùng khuôn `destinations/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ form client của từng tab.
 * - Quyền KHÔNG kiểm ở đây: gác ở `AuthGuard` + `@Roles(ADMIN)` của API.
 * - Input re-parse bằng CHÍNH schema contract: hỏng thì `INVALID_INPUT`.
 * - `cookies()` gọi NGOÀI `try`, và `try` chỉ ôm ĐÚNG lời gọi API.
 * - KHÔNG `revalidatePath`: trang là server component động, client tự
 *   `router.refresh()`; cache WEB do API tự bust sau commit.
 */
export async function updateTourDetailsAction(
  input: AdminTourDetailsInput,
): Promise<EditorWriteResult<DetailsContractCode>> {
  const parsed = AdminTourDetailsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminTourDetail;
  try {
    detail = await updateAdminTourDetails(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyDetailsError(error) };
  }
  return { ok: true, detail };
}

export async function deleteTourAction(input: AdminTourDeleteInput): Promise<DeleteTourResult> {
  const parsed = AdminTourDeleteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let deleted: AdminTourDeleteResult;
  try {
    deleted = await deleteAdminTour(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyDeleteTourError(error) };
  }
  return { ok: true, deleted };
}
