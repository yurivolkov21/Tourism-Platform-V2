import { SidebarInset, SidebarProvider } from '@tourism/ui/components/sidebar';
import type * as React from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import type { SessionUser } from '@/lib/api/session';

/**
 * Khung shell cho các trang VÙNG (spec P4b) — sidebar + topbar + vùng nội
 * dung, đúng cấu trúc block `dashboard-01` mà trang `/` đang dùng.
 *
 * Vì sao là component chứ không phải `(admin)/layout.tsx`: trang dashboard tự
 * mang shell của block (vòng gọt 21/08 cố ý bỏ AppShell của P4a, layout chỉ
 * còn là CỔNG GÁC session). Đặt shell vào layout sẽ bọc dashboard hai lần —
 * nên vùng mới dùng chung component này, trang `/` giữ nguyên không đụng tới.
 */
export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
