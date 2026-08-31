import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell';
import { CancellationsTable } from '@/components/cancellations/cancellations-table';
import { fetchAdminCancellations } from '@/lib/api/cancellations';
import { getServerSession } from '@/lib/api/session';
import { parseCancellationsSearchParams } from '@/lib/cancellations-query';
import { toCancellationRow } from '@/lib/cancellations-view';
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
  const [session, paged] = await Promise.all([
    getServerSession(),
    fetchAdminCancellations(cookie, query),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp trang bookings).
  if (!session) return null;

  return (
    <AdminShell user={session}>
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
