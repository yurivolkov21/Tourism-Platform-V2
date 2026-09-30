'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { buttonVariants } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { CalendarDaysIcon, ChevronLeftIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatDateTime } from '@/lib/bookings-view';
import { TOURS_LIST_HREF } from '@/lib/departures-query';
import { tourPageUrl } from '@/lib/site';
import { activeTourStep } from '@/lib/tour-editor-view';
import { departuresHref } from '@/lib/tours-query';

/**
 * Phần đầu khu sửa tour (ADR-0049 §4): chỉ còn TRẠNG THÁI, không còn điều khiển —
 * link về Tours, tên tour, đường dẫn và lần lưu cuối, chip On sale / Off sale,
 * View on site và Departures.
 *
 * - Công tắc On sale dời xuống bước Review & publish (§3).
 * - View on site chỉ khi đang bán: tour tắt bán thì trang web 404.
 * - Departures không phải bước (§5): nút riêng, `aria-current="page"` ở trang của nó —
 *   đúng chỗ `activeTourStep` trả `null`, nên thanh bước và nút này không thể cùng sáng.
 */
const t = messages.admin.tours.editor;

export function TourWorkspaceHeader({ detail }: { detail: AdminTourDetail }) {
  const onDepartures = activeTourStep(usePathname(), detail.slug) === null;

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={TOURS_LIST_HREF}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {t.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{detail.title}</h2>
          <p className="text-sm text-muted-foreground">
            /tours/{detail.slug} · {t.header.lastSaved(formatDateTime(detail.version))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-7 gap-1.5 px-2.5 text-sm">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                detail.isPublished ? 'bg-success' : 'bg-muted-foreground',
              )}
            />
            {detail.isPublished ? t.header.onSale : t.header.offSale}
          </Badge>
          {detail.isPublished ? (
            <ButtonLink
              variant="outline"
              href={tourPageUrl(detail.slug)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
              {t.header.viewOnSite}
            </ButtonLink>
          ) : null}
          <Link
            href={departuresHref(detail.slug)}
            aria-current={onDepartures ? 'page' : undefined}
            className={buttonVariants({ variant: 'outline' })}
          >
            <CalendarDaysIcon data-icon="inline-start" aria-hidden="true" />
            {t.tabs.departures}
          </Link>
        </div>
      </div>
    </div>
  );
}
