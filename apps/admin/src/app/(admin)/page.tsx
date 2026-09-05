// Vòng redesign shell 20/08: TÁI HIỆN 100% block `dashboard-01` của shadcn
// (user chốt — cài qua CLI kèm data mẫu) ngay trên admin thật, nằm TRONG
// cổng gác (admin)/layout. P4d (ADR-0036) chỉ ĐỔ SỐ THẬT vào ba khối, giữ
// nguyên dáng đã chốt 1:1.

import { SidebarInset, SidebarProvider } from '@tourism/ui/components/sidebar';
import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/app-sidebar';
import { RecentBookingsTable } from '@/components/bookings/recent-bookings-table';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { StatCardRow } from '@/components/kit/stat-card';
import { SiteHeader } from '@/components/site-header';
import { fetchRecentAdminBookings, RECENT_BOOKINGS_LIMIT } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminBookingsStats, fetchAdminDashboardSeries } from '@/lib/api/stats';
import { toBookingRow } from '@/lib/bookings-view';
import { toBookingsStatCards } from '@/lib/stats-view';

export default async function Page() {
  const cookie = (await cookies()).toString();
  // Layout (admin) đã gác session + role — ở đây chỉ đọc để đổ vào nav-user
  // (vòng gọt bước 2, 21/08). Null chỉ xảy ra khi race hết hạn giữa hai
  // request — rơi về layout xử lý ở lần điều hướng kế. Session và số liệu
  // là các request độc lập: chạy song song (nếp `/bookings`).
  //
  // Card: `admin.stats.bookings` KHÔNG tham số → cửa sổ trượt 28 ngày, đúng
  // cách gọi ADR-0028 §1 đã hẹn cho dashboard; cùng kit `StatCardRow` +
  // `toBookingsStatCards` với `/bookings`, không có bản card thứ hai.
  //
  // Biểu đồ: chuỗi 90 ngày MỘT lần, không cache (ADR-0036 §2); bộ chọn 7/30
  // cắt đuôi ở client.
  //
  // Bảng: mười booking mới nhất qua `admin.bookings.list` (ADR-0036 §3).
  const [session, stats, series, recent] = await Promise.all([
    getServerSession(),
    fetchAdminBookingsStats(cookie),
    fetchAdminDashboardSeries(cookie),
    fetchRecentAdminBookings(cookie),
  ]);
  if (!session) return null;
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={session} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <StatCardRow cards={toBookingsStatCards(stats)} />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive points={series.points} currency={series.currency} />
              </div>
              <RecentBookingsTable
                // `toBookingRow` cần một query để dựng href mang bộ lọc; bảng
                // này không đọc `href` (cột Code đi qua `BookingLink`, href
                // trần) nên truyền query rỗng — không có bộ lọc nào để mang.
                rows={recent.map((booking) =>
                  toBookingRow(booking, { page: 1, limit: RECENT_BOOKINGS_LIMIT, allDates: true }),
                )}
              />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
