import { isDefinedError, safe } from '@orpc/client';
import type { AdminUserByIdInput, AdminUserDetail, AdminUserRow, Paged } from '@tourism/contract';
import type { UsersQuery } from '@/lib/users-query';
import { api, withAdminAuth } from './client';

/** Bọc mỏng `admin.users.*` (P4f) — cùng nếp `lib/api/enquiries.ts`. Quyền gác ở API. */
export async function fetchAdminUsers(
  cookie: string,
  query: UsersQuery,
): Promise<Paged<AdminUserRow>> {
  return api.admin.users.list(query, { context: withAdminAuth(cookie) });
}

/** Một tài khoản; `null` khi API nói NOT_FOUND (trang gọi `notFound()`). */
export async function fetchAdminUser(
  cookie: string,
  input: AdminUserByIdInput,
): Promise<AdminUserDetail | null> {
  const [error, data] = await safe(api.admin.users.byId(input, { context: withAdminAuth(cookie) }));
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}
