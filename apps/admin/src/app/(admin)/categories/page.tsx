import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell';
import { CategoriesTable } from '@/components/categories/categories-table';
import { StripCreateParam } from '@/components/kit/strip-create-param';
import { fetchAdminCategories } from '@/lib/api/categories';
import { getServerSession } from '@/lib/api/session';
import { toCategoryRowVMs } from '@/lib/categories-view';
import { wantsCreate } from '@/lib/create-param';
import type { RawSearchParams } from '@/lib/table-query';
import {
  createCategoryAction,
  deleteCategoryAction,
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
 * `searchParams` chỉ đọc `create=1` của Quick Create — bảng sáu hàng vẫn không
 * phân trang, không lọc. Thứ tự hàng là `order` do server sắp, và cũng là thứ tự
 * chip lọc trên `/tours` của khách — web đọc thẳng `catalog.categories.list`.
 *
 * Trang chở cả năm server action xuống bảng (thay vì để component tự import):
 * bảng và dialog test được với hàm giả, không phải mock `next/headers`.
 */
const t = messages.admin.categories;

export const metadata: Metadata = {
  title: 'Categories — Nexora back office',
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const openCreate = wantsCreate(raw);
  const cookie = (await cookies()).toString();
  const [session, rows] = await Promise.all([getServerSession(), fetchAdminCategories(cookie)]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;

  return (
    <AdminShell user={session}>
      {/* Không còn tiêu đề lớn: thanh tiêu đề của shell đã gọi tên trang, như mọi vùng khác
          (spec 2026-10-05 §4 #11). Câu giải thích giữ lại, thành dòng mờ. */}
      <p className="px-4 text-sm text-muted-foreground lg:px-6">{t.list.subtitle}</p>

      <CategoriesTable
        rows={toCategoryRowVMs(rows)}
        create={createCategoryAction}
        update={updateCategoryAction}
        setActive={setCategoryActiveAction}
        move={moveCategoryAction}
        remove={deleteCategoryAction}
        openCreate={openCreate}
      />
      {openCreate ? <StripCreateParam /> : null}
    </AdminShell>
  );
}
