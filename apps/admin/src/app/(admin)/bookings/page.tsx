import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell';
import { BookingsTable } from '@/components/bookings/bookings-table';
import { BookingsToolbar } from '@/components/bookings/bookings-toolbar';
import { fetchAdminBookings } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import { parseBookingsSearchParams, type RawSearchParams } from '@/lib/bookings-query';
import { toBookingRow } from '@/lib/bookings-view';

/**
 * `/bookings` — vùng admin ĐẦU TIÊN có dữ liệu thật (spec P4b §3-F1).
 *
 * Server component: `searchParams` (page/status/q) → input contract → fetch
 * oRPC kèm cookie forward → truyền một trang đã format xuống bảng client
 * (§2.2). Không có fetch nào từ browser, nên đổi trang/lọc là điều hướng URL
 * chứ không phải state.
 */
export const metadata: Metadata = {
  title: 'Bookings — Nexora back office',
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Layout (admin) đã gác session + role; đọc lại ở đây chỉ để đổ vào nav-user.
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp trang dashboard).
  const session = await getServerSession();
  if (!session) return null;

  const query = parseBookingsSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  const paged = await fetchAdminBookings(cookie, query);

  return (
    <AdminShell user={session}>
      <BookingsToolbar query={query} />
      <BookingsTable
        rows={paged.items.map(toBookingRow)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
      />
    </AdminShell>
  );
}
