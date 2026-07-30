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

/**
 * Khoảng cách từ avatar xuống dropdown, tính bằng px.
 *
 * **20 + 8**, không phải 4 mặc định của `DropdownMenuContent`. Base UI đo `sideOffset`
 * từ chính trigger, nhưng avatar nằm GIỮA dải navbar: nó cao 32px và căn giữa một hàng
 * cao 40px trong `p-4`, nên dải navbar còn thừa đúng **20px** bên dưới nó. Với offset 4
 * thì `popup.top − nav.bottom = −16px` — dropdown chui vào navbar, và hit-test giữa vùng
 * chồng cho ra chính `<nav>` (đo 30/07 với `MOCK_SESSION` tạm bật `SAMPLE_USER`).
 *
 * ⚠️ KHÁC con số 34 của `NAV_DROPDOWN_SIDE_OFFSET` ở `destinations-menu.tsx`, và **đừng
 * gộp hai hằng số lại**: cùng một dải navbar, nhưng trigger ở đó là CHỮ cao 20px nên
 * đệm còn lại là 26px, còn ở đây trigger là avatar cao 32px nên đệm chỉ 20px. Hai con số
 * khác nhau vì hai trigger khác chiều cao, không phải vì tuỳ hứng.
 *
 * Buộc vào `p-4` của `site-header.tsx`, chiều cao nút "Book a tour", và `size-8` của
 * avatar. Đổi ba thứ đó thì đo lại: `popup.top − nav.bottom` phải ra **+8**.
 */
export const USER_MENU_SIDE_OFFSET = 28;

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
      <DropdownMenuContent align="end" sideOffset={USER_MENU_SIDE_OFFSET} className="w-56">
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
