'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeTourTab, TOUR_EDITOR_TABS, tourTabHref } from '@/lib/tour-editor-view';

/**
 * Thanh tab của khu làm việc tour (spec F17 §2g) — năm link, tab đang mở đọc từ
 * pathname nên đúng cả khi admin mở thẳng một đường tab từ thanh địa chỉ.
 *
 * Link thật (`next/link`), không phải nút đổi state: mỗi tab là một trang riêng
 * với lượt đọc riêng, và link rời tab có thay đổi chưa lưu bị
 * `UnsavedChangesProvider` chặn hỏi lại ở pha capture.
 */
const t = messages.admin.tours.editor;

export function TourTabs({ slug }: { slug: string }) {
  const active = activeTourTab(usePathname(), slug);

  return (
    <nav aria-label={t.tabsLabel} className="border-b">
      <ul className="-mb-px flex flex-wrap gap-x-4">
        {TOUR_EDITOR_TABS.map((tab) => {
          const current = tab === active;
          return (
            <li key={tab}>
              <Link
                href={tourTabHref(slug, tab)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex border-b-2 px-1 pb-2 text-sm font-medium',
                  current
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.tabs[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
