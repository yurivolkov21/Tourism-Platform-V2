import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { BookingsTable } from '@/components/bookings/bookings-table';
import { fetchAdminBookings } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import { bookingsHref, parseBookingsSearchParams } from '@/lib/bookings-query';
import { toBookingRow } from '@/lib/bookings-view';
import type { RawSearchParams } from '@/lib/table-query';

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
  const query = parseBookingsSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  // Session (chỉ để đổ vào nav-user — layout đã gác role) và trang dữ liệu
  // là hai request độc lập: chạy song song kẻo TTFB thành 2 RTT nối tiếp
  // trên MỌI click phân trang/lọc (nếp Promise.all như enquire/page.tsx web).
  const [session, paged] = await Promise.all([
    getServerSession(),
    fetchAdminBookings(cookie, query),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp trang dashboard).
  if (!session) return null;

  // Page mồ côi (review F3 31/08 — luật chung với /cancellations): tập kết
  // quả co lại dưới chân URL thì đưa về trang cuối còn thật, không render
  // bảng rỗng cạnh thanh phân trang nói ngược lại.
  if (paged.total > 0 && query.page > paged.totalPages) {
    redirect(bookingsHref(query, { page: paged.totalPages }));
  }

  return (
    <AdminShell user={session}>
      <BookingsTable
        rows={paged.items.map(toBookingRow)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
      />
    </AdminShell>
  );
}
