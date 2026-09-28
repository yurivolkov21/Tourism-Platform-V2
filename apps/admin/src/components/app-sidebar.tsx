'use client';

import { messages } from '@tourism/i18n';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@tourism/ui/components/sidebar';
import { TooltipProvider } from '@tourism/ui/components/tooltip';
import type * as React from 'react';
import { Logo } from '@/components/logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import type { SessionUser } from '@/lib/api/session';

/**
 * Sidebar của shell. Thu gọn thì thành CỘT ICON (`collapsible="icon"`, góp ý giao
 * diện 28/09, demo đã duyệt) chứ không trượt mất hẳn như `offcanvas` trước đây —
 * trang không còn nút điều hướng nào. Ở cột icon, tooltip là nhãn duy nhất của mỗi
 * icon nên chúng bật ngay (`TooltipProvider` mặc định không trễ). Điện thoại vẫn
 * là ngăn kéo trượt: component Sidebar tự đổi sang Sheet dưới 768px.
 */
export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SessionUser }) {
  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              {/* Logo Slidex + chip — thay "Acme Inc." mẫu (vòng gọt 21/08). */}
              <SidebarMenuButton
                tooltip={messages.admin.shell.logoTooltip}
                className="data-[slot=sidebar-menu-button]:p-1.5!"
                render={<a href="/" />}
              >
                {/* Chip "back office" đã bỏ — user chê không hợp (21/08). */}
                <Logo tone="sidebar" className="[&>span]:text-base" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
