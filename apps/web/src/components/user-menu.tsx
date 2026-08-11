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
import { useRouter } from 'next/navigation';
import { authClient, useSession } from '@/lib/auth-client';

/**
 * Khoảng cách từ avatar xuống dropdown, tính bằng px.
 *
 * **20 + 8**, không phải 4 mặc định của `DropdownMenuContent`. Base UI đo `sideOffset`
 * từ chính trigger, nhưng avatar nằm GIỮA dải navbar: nó cao 32px và căn giữa một hàng
 * cao 40px trong `p-4`, nên dải navbar còn thừa đúng **20px** bên dưới nó. Với offset 4
 * thì `popup.top − nav.bottom = −16px` — dropdown chui vào navbar, và hit-test giữa vùng
 * chồng cho ra chính `<nav>` (đo 30/07 với session giả có user, bật tạm qua
 * hằng số mock hồi đó dùng — trước khi Task 6 nối `useSession()` thật).
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
// (tên/email · My account · Saved tours · Sign out). Task 6 (auth-pages-api):
// state đọc từ `useSession()` (Better Auth client) thay cho hằng mock tĩnh
// cũ. Fix cuối 11/08: "My bookings" đổi thành "Saved tours" (→
// `/account/saved`) — "My account" (→ `/account`, trang hộ chiếu) từ redesign
// M1 đã LÀ cửa vào bookings (Your journey), hai mục trỏ gần như cùng một
// đích là trùng lặp thật sự, không phải hai lối đi khác nhau.
export function UserMenu({ linkClassName }: { linkClassName?: string }) {
  const { data, isPending } = useSession();
  const router = useRouter();

  // isPending cũng render nhánh chưa đăng nhập: BA cần một round-trip
  // `/get-session` trước khi biết chắc, và trong lúc chờ thà hiện "Log in"
  // ổn định còn hơn chớp avatar rồi rớt xuống nếu hoá ra chưa đăng nhập.
  if (isPending || !data?.user) {
    return (
      <a href="/login" className={linkClassName}>
        Log in
      </a>
    );
  }

  const { user } = data;

  // Sign out CLIENT-SIDE (không server action): store BA cập nhật navbar
  // ngay lập tức, không cần đợi full reload — bài học Nexora, ADR-0017 §2.
  async function handleSignOut() {
    await authClient.signOut();
    router.push('/');
    router.refresh();
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
          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={USER_MENU_SIDE_OFFSET} className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<a href="/account" />}>
            <UserIcon aria-hidden="true" />
            My account
          </DropdownMenuItem>
          {/* Fix cuối 11/08: "My bookings" → "Saved tours" trỏ `/account/saved`
              — "My account" (route `/account`, trang hộ chiếu) đã LÀ cửa vào
              bookings (Your journey), hai mục cùng trỏ gần như một đích đọc
              trùng lặp. Không có key i18n web nào sẵn khớp nghĩa "Saved
              tours" trong ngữ cảnh menu này (grep: `accountSaved.title` =
              "Tucked inside", khác giọng) nên giữ literal như `My account`/
              `Sign out` cạnh nó — component này chưa đi qua i18n. */}
          <DropdownMenuItem render={<a href="/account/saved" />}>
            <TicketIcon aria-hidden="true" />
            Saved tours
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOutIcon aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
