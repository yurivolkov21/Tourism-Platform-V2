'use client';

import { messages } from '@tourism/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@tourism/ui/components/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@tourism/ui/components/tooltip';
import { CirclePlusIcon, Compass, FileText, MapPin, Tags } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { requestCreate } from '@/lib/quick-create';

/**
 * Nút Quick Create của sidebar thành MENU tạo nhanh (spec 2026-10-05 §2.5) — trước đây là
 * nút chép nguyên từ block dashboard-01, không gắn hành động nào. Nhãn mỗi mục là đúng chữ
 * nút tạo của vùng ấy, icon là icon của vùng trên sidebar (`lib/nav.ts`).
 *
 * Mỗi mục ghi một yêu cầu mở hộp tạo (`lib/quick-create.ts`) thay cho tham số URL cũ (review
 * A2-3, EF1, RU6):
 * - Trang của mục KHÁC trang đang mở: mục là Link tới path trần; trang đích mount thì mở hộp.
 * - Trang của mục CHÍNH LÀ trang đang mở: mục không điều hướng, hộp của trang mở ngay — query
 *   lọc giữ nguyên, không thêm mục lịch sử, không lượt render server nào.
 *
 * Chỉ KHUÔN GHÉP trigger là chung với `NavUser`: nút là trigger của cả menu lẫn tooltip, lồng
 * qua `render`, và tooltip chỉ hiện ở cột icon (nhãn đã nằm cạnh icon khi mở rộng). Hướng mở
 * thì riêng: menu này mở bên phải khi sidebar thu về cột icon, bên dưới khi mở rộng hay trên
 * điện thoại — còn menu của `NavUser` mở bên phải trừ trên điện thoại.
 */
const ITEMS = [
  {
    key: 'tour',
    path: '/tours',
    label: messages.admin.tours.editor.create.action,
    icon: Compass,
  },
  {
    key: 'post',
    path: '/posts',
    label: messages.admin.posts.create.action,
    icon: FileText,
  },
  {
    key: 'category',
    path: '/categories',
    label: messages.admin.categories.create.action,
    icon: Tags,
  },
  {
    key: 'destination',
    path: '/destinations',
    label: messages.admin.destinations.create.action,
    icon: MapPin,
  },
] as const;

export function QuickCreateMenu() {
  const { isMobile, state } = useSidebar();
  const pathname = usePathname();
  const t = messages.admin.shell;
  const collapsed = state === 'collapsed' && !isMobile;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <Tooltip>
            <DropdownMenuTrigger
              render={
                <TooltipTrigger
                  render={
                    <SidebarMenuButton className="min-w-8 bg-sidebar-cta text-sidebar-cta-foreground duration-200 ease-linear hover:bg-sidebar-primary hover:text-sidebar-primary-foreground active:bg-sidebar-primary active:text-sidebar-primary-foreground aria-expanded:bg-sidebar-primary aria-expanded:text-sidebar-primary-foreground" />
                  }
                />
              }
            >
              <CirclePlusIcon aria-hidden="true" />
              <span>{t.quickCreate}</span>
            </DropdownMenuTrigger>
            <TooltipContent side="right" hidden={!collapsed}>
              {t.quickCreate}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            className="min-w-56"
            side={collapsed ? 'right' : 'bottom'}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t.quickCreateMenu}</DropdownMenuLabel>
              {ITEMS.map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  // Cùng trang thì mục là mục menu thường: điều hướng tới chính trang này chỉ để
                  // mở hộp là đẩy thêm một mục lịch sử và vứt query lọc đang xem.
                  render={pathname === item.path ? undefined : <Link href={item.path} />}
                  // Ghi TRƯỚC khi Link điều hướng: trang đích mount là đã có yêu cầu để tiêu thụ.
                  onClick={() => requestCreate(item.key)}
                >
                  <item.icon aria-hidden="true" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
