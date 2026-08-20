// Vòng redesign shell 20/08: TÁI HIỆN 100% block `dashboard-01` của shadcn
// (user chốt — cài qua CLI kèm data mẫu) ngay trên admin thật, nằm TRONG
// cổng gác (admin)/layout. Bước sau mới gọt: nav thật 15 mục, user thật,
// dọn data mẫu — đừng "thuần hóa" trước khi user chấm bản 1:1.

import { SidebarInset, SidebarProvider } from '@tourism/ui/components/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DataTable } from '@/components/data-table';
import { SectionCards } from '@/components/section-cards';
import { SiteHeader } from '@/components/site-header';

import data from './data.json';

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
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
