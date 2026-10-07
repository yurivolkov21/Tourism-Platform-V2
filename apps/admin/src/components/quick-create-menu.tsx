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
import { CirclePlusIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type * as React from 'react';
import { NAV_GROUPS, navPath } from '@/lib/nav';
import { requestCreate } from '@/lib/quick-create';

/** Path trần và icon của vùng `key` trên sidebar. Khoá sai là lỗi lập trình — ném lúc nạp module. */
function navArea(key: string) {
  const item = NAV_GROUPS.flatMap((group) => group.items).find((entry) => entry.key === key);
  if (item === undefined) throw new Error(`Quick Create: no nav item "${key}"`);
  return { path: navPath(item.href), icon: item.icon };
}

/**
 * Cú bấm kèm Ctrl/Cmd/Shift/Alt — trên link, Next Link nhường hẳn nó cho trình duyệt (mở tab hay
 * cửa sổ mới, Alt thì tải về; `isModifiedEvent` của `next/dist/client/app-dir/link.js`), trang
 * đang xem không đổi. Bấm chuột giữa không tới đây: nó phát `auxclick`, không phát `click`.
 */
function isModifiedClick(event: React.MouseEvent): boolean {
  return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

/**
 * Nút Quick Create của sidebar thành MENU tạo nhanh (spec 2026-10-05 §2.5) — trước đây là
 * nút chép nguyên từ block dashboard-01, không gắn hành động nào. Nhãn mỗi mục là đúng chữ
 * nút tạo của vùng ấy; path và icon tra từ mục của vùng trên sidebar (`lib/nav.ts`) theo khoá,
 * không gõ lại (review RU4).
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
  { key: 'tour', label: messages.admin.tours.editor.create.action, ...navArea('tours') },
  { key: 'post', label: messages.admin.posts.create.action, ...navArea('posts') },
  { key: 'category', label: messages.admin.categories.create.action, ...navArea('categories') },
  {
    key: 'destination',
    label: messages.admin.destinations.create.action,
    ...navArea('destinations'),
  },
] as const;

export function QuickCreateMenu() {
  const { isMobile, state, setOpenMobile } = useSidebar();
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
              {ITEMS.map((item) => {
                const samePage = pathname === item.path;
                return (
                  <DropdownMenuItem
                    key={item.key}
                    // Cùng trang thì mục là mục menu thường: điều hướng tới chính trang này chỉ để
                    // mở hộp là đẩy thêm một mục lịch sử và vứt query lọc đang xem.
                    render={samePage ? undefined : <Link href={item.path} />}
                    onClick={(event) => {
                      // Link + Ctrl/Cmd/Shift/Alt: trình duyệt mở trang đích ở tab/cửa sổ mới, tab
                      // này đứng yên. Yêu cầu sống trong bộ nhớ của TAB NÀY nên tab mới không thấy
                      // nó; ghi ra chỉ để nó treo tới 10 giây và mở hộp bất ngờ khi người dùng ghé
                      // trang đích ở tab này. Người dùng vẫn ở trang này nên Sheet cũng giữ nguyên.
                      // Mục cùng trang không phải link — không có gì để nhường, bấm như thường.
                      if (!samePage && isModifiedClick(event)) return;
                      // Điện thoại: đóng Sheet sidebar (review B2). Cùng trang thì không có lượt dựng
                      // trang mới nào gỡ nó, và hộp tạo sẽ mở chồng lên một Sheet còn mở.
                      setOpenMobile(false);
                      // Ghi TRƯỚC khi Link điều hướng: trang đích mount là đã có yêu cầu để tiêu thụ.
                      requestCreate(item.key);
                    }}
                  >
                    <item.icon aria-hidden="true" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
