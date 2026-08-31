import { redirect } from 'next/navigation';
import { decideAdminAccess } from '@/lib/admin-gate';
import { getServerSession } from '@/lib/api/session';

/**
 * Tầng gác THẬT của admin (spec P4a §2): proxy chỉ kiểm cookie tồn tại,
 * layout này hỏi API (`getServerSession`) rồi quyết bằng đúng hàm thuần
 * `decideAdminAccess`. Mọi trang trong nhóm (admin) render DƯỚI cổng này —
 * không trang nào tự lo auth lại.
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();
  // Path thật nằm ở proxy; ở tầng layout Next không cho đọc pathname trực
  // tiếp — nhánh `login` ở đây chỉ xảy ra khi cookie có mà session chết
  // (hết hạn/tombstone), quay về "/" sau đăng nhập là đủ.
  const decision = decideAdminAccess(session ? { role: session.role } : null, '/');
  if (decision.kind === 'login') redirect('/login');
  if (decision.kind === 'deny') redirect('/not-authorized');

  // decision.kind === 'allow' ⇒ session không null (path '/' không public).
  if (!session) redirect('/login');
  // Shell nằm trong từng trang (block dashboard-01 tự mang SidebarProvider) —
  // layout chỉ còn là CỔNG GÁC (AppShell P4a đã xoá ở vòng gọt 21/08).
  return <>{children}</>;
}
