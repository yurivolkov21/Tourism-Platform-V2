import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { EnquiriesTable } from '@/components/enquiries/enquiries-table';
import { StatCardRow } from '@/components/kit/stat-card';
import { fetchAdminEnquiries } from '@/lib/api/enquiries';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminEnquiriesStats } from '@/lib/api/stats';
import { enquiriesHref, parseEnquiriesSearchParams } from '@/lib/enquiries-query';
import { toEnquiryRowVM, tourFilterLabel } from '@/lib/enquiries-view';
import { toEnquiriesStatCards } from '@/lib/stats-view';
import type { RawSearchParams } from '@/lib/table-query';

/**
 * `/enquiries` — CRM lead của form "Inquire Now" (spec P4c §3-F9).
 *
 * Server component đúng nếp `/outbox` (spec P4b §2.2): `searchParams`
 * (page/status/q/tourId) → input contract → fetch oRPC kèm cookie forward →
 * truyền một trang đã format xuống bảng client. Hàng stat card fetch CÙNG ĐỢT
 * với list.
 *
 * Trang này KHÔNG ghi gì — hai hành vi ghi của vùng nằm ở `/enquiries/[id]`,
 * nơi có đủ ngữ cảnh (message của khách, thread note) để quyết định.
 */
export const metadata: Metadata = {
  title: 'Enquiries — Nexora back office',
};

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseEnquiriesSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  const [session, paged, stats] = await Promise.all([
    getServerSession(),
    fetchAdminEnquiries(cookie, query),
    fetchAdminEnquiriesStats(cookie),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;

  // Page mồ côi: tab NEW co lại sau mỗi lần đổi trạng thái — đưa về trang cuối
  // còn thật thay vì bảng rỗng cạnh thanh phân trang nói ngược lại.
  if (paged.total > 0 && query.page > paged.totalPages) {
    redirect(enquiriesHref(query, { page: paged.totalPages }));
  }

  return (
    <AdminShell user={session}>
      <StatCardRow cards={toEnquiriesStatCards(stats)} />
      <EnquiriesTable
        rows={paged.items.map(toEnquiryRowVM)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
        tourFilter={tourFilterLabel(paged.items, query.tourId)}
      />
    </AdminShell>
  );
}
