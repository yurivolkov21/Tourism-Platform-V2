import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell';
import { CategoriesTable } from '@/components/categories/categories-table';
import { fetchAdminCategories } from '@/lib/api/categories';
import { getServerSession } from '@/lib/api/session';
import { toCategoryRowVMs } from '@/lib/categories-view';
import {
  createCategoryAction,
  moveCategoryAction,
  setCategoryActiveAction,
  updateCategoryAction,
} from './actions';

/**
 * `/categories` — danh mục tour (spec P4e-2 F14).
 *
 * Server component đúng nếp `/tours`: fetch oRPC kèm cookie forward, rồi truyền
 * một danh sách đã format xuống bảng client.
 *
 * KHÔNG có `searchParams`: bảng này sáu hàng, không phân trang, không lọc. Thứ
 * tự hàng là `order` do server sắp — sẽ thành thứ tự chip lọc khách nhìn thấy
 * khi Task 5 nối web vào endpoint danh mục (hôm nay web vẫn suy chip từ tour).
 *
 * Trang chở cả bốn server action xuống bảng (thay vì để component tự import):
 * bảng và dialog test được với hàm giả, không phải mock `next/headers`.
 */
const t = messages.admin.categories;

export const metadata: Metadata = {
  title: 'Categories — Nexora back office',
};

export default async function CategoriesPage() {
  const cookie = (await cookies()).toString();
  const [session, rows] = await Promise.all([getServerSession(), fetchAdminCategories(cookie)]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;

  return (
    <AdminShell user={session}>
      <div className="flex flex-col gap-1 px-4 lg:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">{t.list.heading}</h2>
        <p className="text-sm text-muted-foreground">{t.list.subtitle}</p>
      </div>

      <CategoriesTable
        rows={toCategoryRowVMs(rows)}
        create={createCategoryAction}
        update={updateCategoryAction}
        setActive={setCategoryActiveAction}
        move={moveCategoryAction}
      />
    </AdminShell>
  );
}
