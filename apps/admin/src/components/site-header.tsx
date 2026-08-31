'use client';

import { messages } from '@tourism/i18n';
import { Separator } from '@tourism/ui/components/separator';
import { SidebarTrigger } from '@tourism/ui/components/sidebar';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from '@/lib/nav';

/**
 * Header shell — vòng gọt bước 3 (21/08): "Documents" cứng của block →
 * tiêu đề THEO TRANG, tra từ chính `lib/nav.ts` (một nguồn với sidebar —
 * thêm vùng mới ở nav.ts là header tự đúng, không sửa hai nơi). Trang con
 * sâu hơn (vd /tours/abc) khớp theo tiền tố dài nhất; không khớp gì rơi về
 * Dashboard.
 */
function pageTitle(pathname: string): string {
  const items = NAV_GROUPS.flatMap((group) => group.items);
  let best = items.find((item) => item.href === '/');
  let bestLength = 0;
  for (const item of items) {
    if (item.href !== '/' && pathname.startsWith(item.href) && item.href.length > bestLength) {
      best = item;
      bestLength = item.href.length;
    }
  }
  if (pathname === '/') best = items.find((item) => item.href === '/');
  return best?.label ?? messages.admin.shell.dashboard;
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <h1 className="text-base font-medium">{pageTitle(pathname)}</h1>
      </div>
    </header>
  );
}
