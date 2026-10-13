import { AdminUserByIdInputSchema } from '@tourism/contract';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UserDetail } from '@/components/users/user-detail';
import { requirePageAccess } from '@/lib/admin-access';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminUser } from '@/lib/api/users';
import type { RawSearchParams } from '@/lib/table-query';
import { usersBackHref } from '@/lib/users-query';
import { toUserDetailVM } from '@/lib/users-view';
import {
  lockUserAction,
  revokeUserSessionsAction,
  setUserRoleAction,
  unlockUserAction,
} from './actions';

/**
 * `/users/[id]` — một tài khoản (P4f, spec §7.2). `id` từ URL đi qua CHÍNH schema contract
 * trước khi fetch: đoạn rác là `notFound()` chứ không phải một 400 vẽ ra màn lỗi chung.
 * Chỉ Owner: chặn TRƯỚC khi gọi API (plan P4f, quyết định 13).
 *
 * Tiêu đề tab CỐ ĐỊNH, không mang tên người — tên và email là PII, không cần nằm trong lịch
 * sử duyệt web (cùng lý do `/enquiries/[id]`).
 */
export const metadata: Metadata = {
  title: 'User — Nexora back office',
};

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { id } = await params;
  const parsed = AdminUserByIdInputSchema.safeParse({ id });
  if (!parsed.success) notFound();

  const session = await getServerSession();
  if (!session) return null;
  requirePageAccess(session, 'users.byId');

  const backHref = usersBackHref((await searchParams).back);
  const cookie = (await cookies()).toString();
  const user = await fetchAdminUser(cookie, parsed.data);
  if (!user) notFound();

  return (
    <AdminShell user={session}>
      <UserDetail
        detail={toUserDetailVM(user)}
        backHref={backHref}
        actions={{
          setRole: setUserRoleAction,
          lock: lockUserAction,
          unlock: unlockUserAction,
          revokeSessions: revokeUserSessionsAction,
        }}
      />
    </AdminShell>
  );
}
