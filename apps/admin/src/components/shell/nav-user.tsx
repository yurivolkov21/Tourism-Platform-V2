'use client';

import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@tourism/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import { SidebarMenuButton } from '@tourism/ui/components/sidebar';
import { ChevronsUpDown, ExternalLink, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/api/session';
import { authClient } from '@/lib/auth-client';

const SITE_URL = 'https://www.nexora-travel.agency';

/** Chân sidebar: avatar + tên + menu (về site, sign out) — island client. */
export function NavUser({ user }: { user: SessionUser }) {
  const router = useRouter();
  const t = messages.admin.shell;
  const initial = (user.name || user.email).slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
        <Avatar className="size-8">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <span className="grid flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <ChevronsUpDown className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href={SITE_URL} target="_blank" rel="noreferrer" />}>
          <ExternalLink className="size-4" />
          {t.viewSite}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            // Sign out xong về /login — router.refresh() không đủ vì layout
            // gác cổng đọc session server-side, cần điều hướng hẳn.
            await authClient.signOut();
            router.push('/login');
            router.refresh();
          }}
        >
          <LogOut className="size-4" />
          {t.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
