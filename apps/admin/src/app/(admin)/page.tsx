// Vòng redesign shell 20/08: TÁI HIỆN 100% block `dashboard-01` của shadcn
// (user chốt — cài qua CLI kèm data mẫu) ngay trên admin thật, nằm TRONG
// cổng gác (admin)/layout. P4d (ADR-0036) chỉ ĐỔ SỐ THẬT vào ba khối, giữ
// nguyên dáng đã chốt 1:1.

import { messages } from '@tourism/i18n';
import { SidebarInset, SidebarProvider } from '@tourism/ui/components/sidebar';
import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/app-sidebar';
import { RecentBookingsTable } from '@/components/bookings/recent-bookings-table';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { SectionError } from '@/components/kit/section-error';
import { StatCardRow } from '@/components/kit/stat-card';
import { SiteHeader } from '@/components/site-header';
import { fetchRecentAdminBookings } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminBookingsStats, fetchAdminDashboardSeries } from '@/lib/api/stats';
import { toBookingRow } from '@/lib/bookings-view';
import { statsPeriodLabel, toBookingsStatCards } from '@/lib/stats-view';

const t = messages.admin.dashboard;

/**
 * Một khối hỏng KHÔNG kéo sập cả trang (ADR-0036 AMEND 2). Trang vùng theo
 * luật "không nuốt lỗi" ở `lib/api/stats.ts` vì card đứng cạnh bảng của
 * chính nó; `/` là trang đầu tiên có BA khối độc lập chung một số phận, và
 * `app/error.tsx` cố ý không dựng shell — một endpoint 404 vài phút lúc lệch
 * phiên bản deploy (ADR-0024) từng đủ để admin mất sidebar, tức mất đường
 * sang các hàng đợi vẫn đang chạy tốt. Lỗi vẫn được log, không im lặng.
 */
function settled<T>(result: PromiseSettledResult<T>, block: string): T | null {
  if (result.status === 'fulfilled') return result.value;
  console.error(`[admin] dashboard block "${block}" failed`, result.reason);
  return null;
}

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
  const [session, statsResult, seriesResult, recentResult] = await Promise.all([
    getServerSession(),
    ...(await Promise.allSettled([
      fetchAdminBookingsStats(cookie),
      fetchAdminDashboardSeries(cookie),
      fetchRecentAdminBookings(cookie),
    ])),
  ]);
  if (!session) return null;
  const stats = settled(statsResult, 'cards');
  const series = settled(seriesResult, 'chart');
  const recent = settled(recentResult, 'recent');
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
              {stats ? (
                // `period` như mọi vùng khác: hôm nay cửa sổ trượt nên nhãn
                // undefined (ADR-0028 §4), nhưng ngày dashboard có kỳ chọn thì
                // dòng Showing mọc — không phải sửa trang.
                <StatCardRow
                  cards={toBookingsStatCards(stats)}
                  period={statsPeriodLabel(stats.period)}
                />
              ) : (
                <div className="px-4 lg:px-6">
                  <SectionError message={t.loadError(t.blocks.cards)} />
                </div>
              )}
              <div className="px-4 lg:px-6">
                {series ? (
                  <ChartAreaInteractive series={series} />
                ) : (
                  <SectionError message={t.loadError(t.blocks.chart)} />
                )}
              </div>
              {recent ? (
                // Không query: bảng này không mang bộ lọc nào, `href` là đường
                // trần `/bookings/<code>` (cùng thứ `BookingLink` dựng).
                <RecentBookingsTable rows={recent.map((booking) => toBookingRow(booking))} />
              ) : (
                <div className="px-4 lg:px-6">
                  <SectionError message={t.loadError(t.blocks.recent)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
