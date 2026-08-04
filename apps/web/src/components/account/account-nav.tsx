'use client';

import { messages } from '@tourism/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 4 tab khu account (dashboard/bookings/saved/profile — spec §3, đủ 6 route
 * nhưng `security` chỉ redirect nên không có tab riêng). `bookings`/`profile`
 * trỏ route Task 4 chưa dựng lúc Task 3 chạy — CÙNG branch, route sẽ sống
 * trước mốc DỪNG A1 (Task 5) nên không phải link chết khi user duyệt.
 */
const TABS = [
  { href: '/account', key: 'dashboard' as const },
  { href: '/account/bookings', key: 'bookings' as const },
  { href: '/account/saved', key: 'saved' as const },
  { href: '/account/profile', key: 'profile' as const },
] as const;

/**
 * Tab nội khu — khuôn mượn từ `CategoryChips` (blog): cùng cách tô sáng tab
 * hiện tại (`border-primary bg-primary text-primary-foreground`) và cùng
 * `aria-current="page"`, KHÔNG dùng `Tabs`/`TabsList` của `@tourism/ui`
 * (primitive đó điều khiển panel qua state JS trong MỘT trang — ở đây mỗi
 * tab là một ROUTE thật, điều hướng bằng URL). Cần `usePathname()` (client)
 * để biết tab nào đang mở — layout.tsx bọc ngoài vẫn là server component,
 * chỉ tách riêng phần nav này ra client.
 */
export function AccountNav() {
  const pathname = usePathname();
  const t = messages.accountNav;

  return (
    <nav aria-label="Account" className="flex flex-wrap items-center gap-2 border-b pb-4">
      {TABS.map((tab) => {
        // Dashboard là route gốc `/account` — so khớp CHÍNH XÁC (không thì
        // mọi tab con cũng khớp prefix `/account` và tab Dashboard luôn sáng
        // dù đang ở /account/saved). Các tab khác so khớp cả path con (vd
        // `/account/bookings/BK-XXXX` vẫn sáng tab Bookings).
        const isActive =
          tab.href === '/account' ? pathname === '/account' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {t[tab.key]}
          </Link>
        );
      })}
    </nav>
  );
}
