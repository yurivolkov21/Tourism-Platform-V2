import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { CancellationsTable } from '@/components/cancellations/cancellations-table';
import { StatCardRow } from '@/components/kit/stat-card';
import { fetchAdminCancellations } from '@/lib/api/cancellations';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminCancellationsStats } from '@/lib/api/stats';
import { cancellationsHref, parseCancellationsSearchParams } from '@/lib/cancellations-query';
import { toCancellationRow } from '@/lib/cancellations-view';
import { toCancellationsStatCards } from '@/lib/stats-view';
import type { RawSearchParams } from '@/lib/table-query';
import { decideCancellationAction } from './actions';

/**
 * `/cancellations` — hàng đợi request của khách (spec P4b §3-F3).
 *
 * Server component đúng nếp `/bookings` (§2.2): `searchParams` (page/status)
 * → input contract → fetch oRPC kèm cookie forward → truyền một trang đã
 * format xuống bảng client. Không có fetch nào từ browser; đổi trang/lọc là
 * điều hướng URL.
 *
 * Hàng stat card (spec §3-F5) đứng TRÊN bảng, fetch cùng đợt `Promise.all`
 * với list — số liệu là ngữ cảnh của bảng, không phải một trang khác.
 *
 * Server action `decideCancellationAction` truyền xuống như một prop — client
 * component không tự import đường server nào (nếp F2).
 */
export const metadata: Metadata = {
  title: 'Cancellations — Nexora back office',
};

export default async function CancellationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseCancellationsSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  // Session (chỉ để đổ vào nav-user — layout đã gác role) và trang dữ liệu là
  // hai request độc lập: chạy song song kẻo TTFB thành 2 RTT nối tiếp trên
  // MỌI click phân trang/lọc.
  const [session, paged, stats] = await Promise.all([
    getServerSession(),
    fetchAdminCancellations(cookie, query),
    // F5: hàng stat card fetch CÙNG ĐỢT với list — nối tiếp sẽ thêm nguyên
    // một RTT vào MỌI click phân trang/lọc chỉ để vẽ lại hàng card.
    fetchAdminCancellationsStats(cookie),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp trang bookings).
  if (!session) return null;

  // Page mồ côi (review F3 31/08): queue CO LẠI sau mỗi decide — admin đứng ở
  // trang 3 khi tập kết quả chỉ còn 2 trang là bảng rỗng cạnh thanh phân
  // trang nói ngược lại. Đưa về trang cuối còn thật thay vì render nghịch lý.
  if (paged.total > 0 && query.page > paged.totalPages) {
    redirect(cancellationsHref(query, { page: paged.totalPages }));
  }

  return (
    <AdminShell user={session}>
      <StatCardRow cards={toCancellationsStatCards(stats)} />
      <CancellationsTable
        rows={paged.items.map(toCancellationRow)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
        decide={decideCancellationAction}
      />
    </AdminShell>
  );
}
