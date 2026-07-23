'use client';

import { Avatar, AvatarFallback } from '@tourism/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import { LogOutIcon, TicketIcon, UserIcon } from 'lucide-react';
import { MOCK_SESSION } from '@/mocks/auth';

// Navbar auth control (convert từ Nexora auth/user-menu.tsx, review navbar):
// chưa đăng nhập → link "Log in"; đã đăng nhập → avatar tròn mở dropdown
// (tên/email · My account · My bookings · Sign out). State đọc từ mock
// (static-first) — thay bằng Better Auth client ở phase auth; các item
// trỏ #top vì trang đích chưa dựng.
export function UserMenu({ linkClassName }: { linkClassName?: string }) {
  if (!MOCK_SESSION) {
    return (
      <a href="/login" className={linkClassName}>
        Log in
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account"
            className="inline-flex cursor-pointer items-center justify-center rounded-full"
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback>{MOCK_SESSION.name.charAt(0)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{MOCK_SESSION.name}</p>
          <p className="truncate text-xs text-muted-foreground">{MOCK_SESSION.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<a href="#top" />}>
            <UserIcon aria-hidden="true" />
            My account
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href="#top" />}>
            <TicketIcon aria-hidden="true" />
            My bookings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* No-op ở bản mock — gắn signOut thật ở phase auth */}
          <DropdownMenuItem>
            <LogOutIcon aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
