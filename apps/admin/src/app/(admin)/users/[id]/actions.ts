'use server';

import {
  type AdminUserByIdInput,
  AdminUserByIdInputSchema,
  type AdminUserLockInput,
  AdminUserLockInputSchema,
  type AdminUserSetRoleInput,
  AdminUserSetRoleInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import {
  lockAdminUser,
  revokeAdminUserSessions,
  setAdminUserRole,
  unlockAdminUser,
} from '@/lib/api/users';
import {
  classifyUserWriteError,
  type LockUserActionResult,
  type RevokeUserSessionsActionResult,
  type SetUserRoleActionResult,
  type UnlockUserActionResult,
} from '@/lib/users-write';

/**
 * Bốn hành vi ghi của vùng Users (P4f) — cùng khuôn `enquiries/[id]/actions.ts`:
 *
 * - Quyền KHÔNG kiểm ở đây: server action là một endpoint POST mở, nên gác ở API
 *   (`@AdminImplement`, thủ tục `owner`), đọc chính cookie được forward.
 * - Input re-parse bằng CHÍNH schema contract trước khi đi → `INVALID_INPUT` thay vì GENERIC.
 * - `cookies()` NGOÀI `try`; `try` chỉ ôm đúng lời gọi API.
 * - Không `revalidatePath`: trang chi tiết là server component động; client gọi
 *   `router.refresh()` sau khi đã báo xong cho Owner (nếp kit `ConfirmWriteDialog`).
 */

export async function setUserRoleAction(
  input: AdminUserSetRoleInput,
): Promise<SetUserRoleActionResult> {
  const parsed = AdminUserSetRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };
  const cookie = (await cookies()).toString();
  try {
    const result = await setAdminUserRole(cookie, parsed.data);
    return { ok: true, role: result.role };
  } catch (error) {
    return { ok: false, code: classifyUserWriteError(error) };
  }
}

export async function lockUserAction(input: AdminUserLockInput): Promise<LockUserActionResult> {
  const parsed = AdminUserLockInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };
  const cookie = (await cookies()).toString();
  try {
    const result = await lockAdminUser(cookie, parsed.data);
    return { ok: true, lockedAt: result.lockedAt };
  } catch (error) {
    return { ok: false, code: classifyUserWriteError(error) };
  }
}

export async function unlockUserAction(input: AdminUserByIdInput): Promise<UnlockUserActionResult> {
  const parsed = AdminUserByIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };
  const cookie = (await cookies()).toString();
  try {
    await unlockAdminUser(cookie, parsed.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, code: classifyUserWriteError(error) };
  }
}

export async function revokeUserSessionsAction(
  input: AdminUserByIdInput,
): Promise<RevokeUserSessionsActionResult> {
  const parsed = AdminUserByIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };
  const cookie = (await cookies()).toString();
  try {
    const result = await revokeAdminUserSessions(cookie, parsed.data);
    return { ok: true, revoked: result.revoked };
  } catch (error) {
    return { ok: false, code: classifyUserWriteError(error) };
  }
}
