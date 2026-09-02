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
  //
  // `data-admin-surface` là MÓC của lớp đè token ở `globals.css` (ADR-0027):
  // vỏ tối + ruột trắng lạnh, chỉ cho các trang trong nhóm này. `login`,
  // `not-authorized`, `not-found` nằm ngoài nhóm nên tự động giữ bề mặt cũ —
  // đó là cách "trừ trang login ra" được thực thi, không phải bằng một danh
  // sách ngoại lệ ai đó phải nhớ cập nhật.
  //
  // `display: contents` để thẻ này KHÔNG tồn tại về mặt bố cục: shell bên
  // trong là một flex root `min-h-svh`, chen một block thường vào giữa là gãy
  // chiều cao. Biến CSS vẫn kế thừa xuống bình thường vì thừa kế không phụ
  // thuộc `display`.
  //
  // Thuộc tính này còn là ĐIỀU KIỆN cho `body:has([data-admin-surface])` ở
  // globals.css (vòng vá review 02/09): overlay của @tourism/ui (Popover,
  // DropdownMenu, Select, Dialog) và toast portal ra `document.body`, tức
  // ngoài cây của div này — vế `body:has()` kéo chúng vào cùng palette.
  return (
    <div data-admin-surface style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
