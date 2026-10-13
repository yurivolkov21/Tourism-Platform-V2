import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UsersTable } from '@/components/users/users-table';
import { requirePageAccess } from '@/lib/admin-access';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminUsers } from '@/lib/api/users';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';
import { parseUsersSearchParams, usersHref } from '@/lib/users-query';
import { toUserRowVM } from '@/lib/users-view';

/**
 * `/users` — vùng Users của Owner (P4f, spec §7.1). Server component đúng nếp `/enquiries`:
 * `searchParams` → input contract → fetch kèm cookie forward → một trang đã nấu xuống bảng.
 * Chỉ Owner: chặn TRƯỚC khi gọi API (plan P4f, quyết định 13).
 */
export const metadata: Metadata = {
  title: 'Users — Nexora back office',
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseUsersSearchParams(await searchParams);
  const session = await getServerSession();
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;
  requirePageAccess(session, 'users.list');

  const cookie = (await cookies()).toString();
  const paged = await fetchAdminUsers(cookie, query);
  // Page mồ côi: tab Locked co lại sau mỗi lần mở khoá — về trang cuối còn thật.
  const orphan = orphanPageHref(paged, query, (page) => usersHref(query, { page }));
  if (orphan) redirect(orphan);

  const listHref = usersHref(query, {});
  return (
    <AdminShell user={session}>
      <UsersTable
        rows={paged.items.map((row) => toUserRowVM(row, listHref))}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
      />
    </AdminShell>
  );
}
