'use client';

import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@tourism/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@tourism/ui/components/sidebar';
import { EllipsisVerticalIcon, ExternalLinkIcon, LogOutIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/api/session';
import { authClient } from '@/lib/auth-client';

const SITE_URL = 'https://www.nexora-travel.agency';

/**
 * Nav-user thật (vòng gọt bước 2, 21/08): khung + style GIỮ NGUYÊN của block
 * dashboard-01, ruột thay bằng session user + menu View site / Sign out
 * (hành vi của shell P4a). Account/Billing/Notifications mẫu đã bỏ — admin
 * chưa có các trang đó (quản hồ sơ là việc của www).
 */
export function NavUser({ user }: { user: SessionUser }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const t = messages.admin.shell;
  const initial = (user.name || user.email).slice(0, 1).toUpperCase();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
          >
            <Avatar className="size-8">
              {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-foreground/70">{user.email}</span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<a href={SITE_URL} target="_blank" rel="noreferrer" />}>
                <ExternalLinkIcon />
                {t.viewSite}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Base UI Menu.Item KHÔNG có `onSelect` (idiom Radix) — phải dùng
                `onClick` như user-menu web; viết onSelect thì prop bị nuốt,
                bấm chỉ đóng menu (bug user báo 21/08). */}
            <DropdownMenuItem
              onClick={async () => {
                // Sign out xong về /login — layout gác đọc session server-side,
                // cần điều hướng hẳn (cùng nếp shell P4a).
                await authClient.signOut();
                router.push('/login');
                router.refresh();
              }}
            >
              <LogOutIcon />
              {t.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
