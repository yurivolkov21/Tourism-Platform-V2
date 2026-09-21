import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { ToursTable } from '@/components/tours/tours-table';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminTours, fetchTourCategories } from '@/lib/api/tours';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';
import { departureMonthOptions, parseToursSearchParams, toursHref } from '@/lib/tours-query';
import { toTourRowVM } from '@/lib/tours-view';
import { setTourPublishedAction } from './actions';

/**
 * `/tours` — bảng vận hành toàn bộ catalogue (spec P4e-1 §3-F11).
 *
 * Server component đúng nếp `/subscribers`/`/outbox` (spec P4b §2.2):
 * `searchParams` (page/limit/category/published/month) → input contract →
 * fetch oRPC kèm cookie forward → truyền một trang đã format xuống bảng
 * client. Server action `setTourPublishedAction` truyền xuống như một prop.
 *
 * KHÔNG có hàng stat card: P4e-1 không mở endpoint stats nào cho catalogue, và
 * bốn ô số bịa từ trang hiện tại sẽ nói dối ngay khi sang trang 2.
 */
export const metadata: Metadata = {
  title: 'Tours — Nexora back office',
};

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseToursSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  const [session, paged, categories] = await Promise.all([
    getServerSession(),
    fetchAdminTours(cookie, query),
    fetchTourCategories(cookie),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;

  // Page mồ côi: tab "Off sale" co lại sau mỗi lần bật bán một tour — đưa về
  // trang cuối còn thật thay vì bảng rỗng cạnh thanh phân trang nói ngược lại.
  const orphan = orphanPageHref(paged, query, (page) => toursHref(query, { page }));
  if (orphan) redirect(orphan);

  return (
    <AdminShell user={session}>
      <ToursTable
        rows={paged.items.map(toTourRowVM)}
        query={query}
        categories={categories}
        // Dải tháng tính Ở SERVER: nhãn tháng là thuần lịch, để client tự dựng
        // là mời đồng hồ/múi giờ của máy người dùng vào một danh sách mà bộ
        // lọc phía API đọc bằng lịch Việt Nam.
        monthOptions={departureMonthOptions(new Date(), undefined, query.month)}
        total={paged.total}
        totalPages={paged.totalPages}
        setPublished={setTourPublishedAction}
      />
    </AdminShell>
  );
}
