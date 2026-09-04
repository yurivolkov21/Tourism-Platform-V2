import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { BookingsTable } from '@/components/bookings/bookings-table';
import { StatCardRow } from '@/components/kit/stat-card';
import { fetchAdminBookings } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminBookingsStats } from '@/lib/api/stats';
import { bookingsHref, parseBookingsSearchParams } from '@/lib/bookings-query';
import { toBookingRow } from '@/lib/bookings-view';
import { statsPeriodLabel, toBookingsStatCards } from '@/lib/stats-view';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';

/**
 * `/bookings` — vùng admin ĐẦU TIÊN có dữ liệu thật (spec P4b §3-F1).
 *
 * Server component: `searchParams` (page/status/q) → input contract → fetch
 * oRPC kèm cookie forward → truyền một trang đã format xuống bảng client
 * (§2.2). Không có fetch nào từ browser, nên đổi trang/lọc là điều hướng URL
 * chứ không phải state.
 *
 * Hàng stat card (spec §3-F5) đứng TRÊN bảng, fetch cùng đợt `Promise.all`
 * với list — số liệu là ngữ cảnh của bảng, không phải một trang khác.
 */
export const metadata: Metadata = {
  title: 'Bookings — Nexora back office',
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // `now` truyền vào chứ không đọc trong hàm: mặc định khoảng ngày là THÁNG
  // HIỆN TẠI (user chốt 04/09) và một hàm thuần thì test được mọi tháng.
  const query = parseBookingsSearchParams(await searchParams, new Date());
  const cookie = (await cookies()).toString();
  // Session (chỉ để đổ vào nav-user — layout đã gác role) và trang dữ liệu
  // là hai request độc lập: chạy song song kẻo TTFB thành 2 RTT nối tiếp
  // trên MỌI click phân trang/lọc (nếp Promise.all như enquire/page.tsx web).
  const [session, paged, stats] = await Promise.all([
    getServerSession(),
    fetchAdminBookings(cookie, query),
    // F5: hàng stat card fetch CÙNG ĐỢT với list — nối tiếp sẽ thêm nguyên
    // một RTT vào MỌI click phân trang/lọc chỉ để vẽ lại hàng card.
    //
    // ADR-0028: card ăn CHÍNH khoảng ngày mà bảng đang lọc. `query` đã qua
    // parse nên nó mang mặc định tháng này, hoặc không mang ngày nào khi admin
    // chọn `?dates=all` — lúc đó server rơi về cửa sổ trượt 28 ngày.
    fetchAdminBookingsStats(cookie, { from: query.from, to: query.to }),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp trang dashboard).
  if (!session) return null;

  // Page mồ côi (review F3 31/08 — luật chung với /cancellations): tập kết
  // quả co lại dưới chân URL thì đưa về trang cuối còn thật, không render
  // bảng rỗng cạnh thanh phân trang nói ngược lại.
  const orphan = orphanPageHref(paged, query, (page) => bookingsHref(query, { page }));
  if (orphan) redirect(orphan);

  return (
    <AdminShell user={session}>
      <StatCardRow cards={toBookingsStatCards(stats)} period={statsPeriodLabel(stats.period)} />
      <BookingsTable
        rows={paged.items.map(toBookingRow)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
      />
    </AdminShell>
  );
}
