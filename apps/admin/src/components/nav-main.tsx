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
                className="min-w-8 bg-sidebar-cta text-sidebar-cta-foreground duration-200 ease-linear hover:bg-sidebar-primary hover:text-sidebar-primary-foreground active:bg-sidebar-primary active:text-sidebar-primary-foreground"
              >
                <CirclePlusIcon />
                <span>Quick Create</span>
              </SidebarMenuButton>
              {/* Cùng bệnh với badge: `outline` mang `bg-background`, tức
                  một ô vuông TRẮNG trên vỏ tối. Ở đây nền nhạt của sidebar
                  gánh vai đó, và thứ định danh nút là ICON (đo 11.56) chứ
                  không phải nét viền — nên viền chỉ còn giữ hình. */}
              <Button
                size="icon"
                className="size-8 border-sidebar-border bg-sidebar-accent text-sidebar-foreground group-data-[collapsible=icon]:opacity-0 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
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
                        {/* Badge `outline` mặc định là `border-border` +
                            `text-foreground` — token của vùng SÁNG, nên trên
                            vỏ tối nó thành viền sáng bọc quanh chữ tàng hình
                            (lỗi user bắt 01/09). Đo: chữ 8.39 (ADR-0027). */}
                        <Badge
                          variant="outline"
                          className="border-sidebar-border text-[10px] text-sidebar-foreground/70"
                        >
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
