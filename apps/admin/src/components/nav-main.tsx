'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@tourism/ui/components/sidebar';
import { cn } from '@tourism/ui/lib/utils';
import { usePathname } from 'next/navigation';
import { QuickCreateMenu } from '@/components/quick-create-menu';
import { isActiveNav, NAV_GROUPS, navTooltip } from '@/lib/nav';

/**
 * Nav chính của shell dashboard-01. Vòng gọt 21/08 (bước 1, user chỉ đạo): phần
 * items mẫu (Lifecycle/Analytics/…) thay bằng 15 mục 3 nhóm THẬT từ `lib/nav.ts`
 * — mục chưa mở gắn badge "Soon" + disabled, KHÔNG link chết (nghiệm thu P4a
 * §0.3, cùng nếp AppShell cũ). Quick Create là menu tạo nhanh (05/10, user chốt),
 * nút mail của block đã bỏ.
 *
 * Cột icon khi thu gọn (góp ý giao diện 28/09, demo đã duyệt): mỗi mục có tooltip
 * (`navTooltip`), trang đang mở có ô sáng (`isActiveNav`), nhãn nhóm ẩn nên ba nhóm
 * cách nhau bằng vạch mảnh.
 */
export function NavMain() {
  const t = messages.admin.shell;
  const pathname = usePathname();
  return (
    <>
      {/* Quick Create thành menu tạo nhanh (spec 2026-10-05 §2.5). Nút phong bì của block
          dashboard-01 bỏ hẳn: không có đích, và Enquiries đã có mục riêng ở nhóm Operations. */}
      <SidebarGroup>
        <SidebarGroupContent>
          <QuickCreateMenu />
        </SidebarGroupContent>
      </SidebarGroup>

      {/* 15 mục 3 nhóm thật — phủ 18 vùng khảo sát 20/08. */}
      {NAV_GROUPS.map((group, index) => (
        <SidebarGroup
          key={group.key}
          // Cột icon không còn nhãn nhóm — vạch mảnh giữ ranh giới giữa ba nhóm.
          className={cn(
            index > 0 &&
              'group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:border-sidebar-border',
          )}
        >
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  {item.enabled ? (
                    <SidebarMenuButton
                      tooltip={navTooltip(item)}
                      isActive={isActiveNav(item.href, pathname)}
                      render={
                        <a
                          href={item.href}
                          aria-current={isActiveNav(item.href, pathname) ? 'page' : undefined}
                        />
                      }
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  ) : (
                    <>
                      {/* Vùng chưa mở, bật dần theo P4b–P4f. `aria-disabled` chứ không
                          `disabled`: nút `disabled` không nhận chuột lẫn tiêu điểm, nên ở
                          cột icon tooltip "… · Soon" — thứ DUY NHẤT nói vì sao không bấm
                          được — không bao giờ hiện. Nút không có hành vi nên bấm vẫn
                          không làm gì. */}
                      <SidebarMenuButton
                        tooltip={navTooltip(item)}
                        aria-disabled="true"
                        className="aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent"
                      >
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
