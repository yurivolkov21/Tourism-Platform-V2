'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@tourism/ui/components/sidebar';
import { CirclePlusIcon, MailIcon } from 'lucide-react';
import { NAV_GROUPS } from '@/lib/nav';

/**
 * Nav chính của shell dashboard-01 — vòng gọt 21/08 (bước 1, user chỉ đạo):
 * GIỮ nguyên khối Quick Create + nút mail của block (user: "sau này sẽ cần
 * dùng tới"); phần items mẫu (Lifecycle/Analytics/…) thay bằng 15 mục 3 nhóm
 * THẬT từ `lib/nav.ts` — mục chưa mở gắn badge "Soon" + disabled, KHÔNG link
 * chết (nghiệm thu P4a §0.3, cùng nếp AppShell cũ).
 */
export function NavMain() {
  const t = messages.admin.shell;
  return (
    <>
      {/* Khối Quick Create — nguyên văn từ block dashboard-01. */}
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <SidebarMenuButton
                tooltip="Quick Create"
                className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              >
                <CirclePlusIcon />
                <span>Quick Create</span>
              </SidebarMenuButton>
              <Button
                size="icon"
                className="size-8 group-data-[collapsible=icon]:opacity-0"
                variant="outline"
              >
                <MailIcon />
                <span className="sr-only">Inbox</span>
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* 15 mục 3 nhóm thật — phủ 18 vùng khảo sát 20/08. */}
      {NAV_GROUPS.map((group) => (
        <SidebarGroup key={group.key}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  {item.enabled ? (
                    <SidebarMenuButton tooltip={item.label} render={<a href={item.href} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  ) : (
                    <>
                      {/* Vùng chưa mở: disabled thật, bật dần theo P4b–P4f. */}
                      <SidebarMenuButton tooltip={item.label} disabled>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>
                        <Badge variant="outline" className="text-[10px]">
                          {t.soon}
                        </Badge>
                      </SidebarMenuBadge>
                    </>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
