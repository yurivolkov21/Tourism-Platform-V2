import type { AdminUserRow, Paged } from '@tourism/contract';
import type { UsersQuery } from '@/lib/users-query';
import { api, withAdminAuth } from './client';

/** Bọc mỏng `admin.users.*` (P4f) — cùng nếp `lib/api/enquiries.ts`. Quyền gác ở API. */
export async function fetchAdminUsers(
  cookie: string,
  query: UsersQuery,
): Promise<Paged<AdminUserRow>> {
  return api.admin.users.list(query, { context: withAdminAuth(cookie) });
}
