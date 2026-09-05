// Vòng redesign shell 20/08: TÁI HIỆN 100% block `dashboard-01` của shadcn
// (user chốt — cài qua CLI kèm data mẫu) ngay trên admin thật, nằm TRONG
// cổng gác (admin)/layout. P4d (ADR-0036) chỉ ĐỔ SỐ THẬT vào ba khối, giữ
// nguyên dáng đã chốt 1:1.

import { SidebarInset, SidebarProvider } from '@tourism/ui/components/sidebar';
import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/app-sidebar';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DataTable } from '@/components/data-table';
import { StatCardRow } from '@/components/kit/stat-card';
import { SiteHeader } from '@/components/site-header';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminBookingsStats } from '@/lib/api/stats';
import { toBookingsStatCards } from '@/lib/stats-view';

import data from './data.json';

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
  const [session, stats] = await Promise.all([getServerSession(), fetchAdminBookingsStats(cookie)]);
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
                <ChartAreaInteractive />
              </div>
              <DataTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
