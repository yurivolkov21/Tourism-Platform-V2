import { messages } from '@tourism/i18n';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { type BookingsListParams, pagerView } from '@/lib/bookings-list';

/**
 * Phân trang "Newer / Older trips" của My bookings (spec P7 §7.4, bản vẽ `booking-list.src.html`
 * kiểu 3). Hai nhãn chỉ đúng vì danh sách luôn xếp theo hành trình (ADR-0054 §4). Link thường
 * — vào lịch sử trình duyệt, khác `router.replace` của hàng lọc — và giữ nguyên bộ lọc.
 *
 * Điện thoại: dòng "Page … of …" lên hàng trên, hai link xuống hàng dưới; từ `sm` là ba phần
 * một hàng như bản vẽ. Vị trí đặt bằng lưới, DOM giữ thứ tự đọc Newer → tóm tắt → Older.
 */
export function TripPager({
  params,
  totalPages,
  total,
  limit,
}: {
  params: BookingsListParams;
  totalPages: number;
  total: number;
  limit: number;
}) {
  const view = pagerView(params, totalPages, total, limit);
  if (view === null) return null;
  const tb = messages.accountBookings;
  const newerClass =
    'col-start-1 row-start-2 inline-flex items-center gap-2 justify-self-start font-semibold sm:row-start-1';

  return (
    <nav
      aria-label={tb.pagerAria}
      className="mt-4 grid grid-cols-2 items-center gap-y-3 border-t border-border pt-3.5 text-[13.5px] sm:grid-cols-[1fr_auto_1fr]"
    >
      {view.newerHref === null ? (
        <span aria-disabled="true" className={`${newerClass} text-muted-foreground/45`}>
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {tb.newerTrips}
        </span>
      ) : (
        <Link
          href={view.newerHref}
          className={`${newerClass} transition-colors hover:text-primary-emphasis`}
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {tb.newerTrips}
        </Link>
      )}
      <p className="col-span-2 col-start-1 row-start-1 text-center text-[13px] text-muted-foreground tabular-nums sm:col-span-1 sm:col-start-2">
        {view.summary}
      </p>
      {view.older === null ? null : (
        <Link
          href={view.older.href}
          aria-label={tb.olderTripsAria(view.older.range)}
          className="group col-start-2 row-start-2 inline-flex items-center gap-2.5 justify-self-end font-semibold sm:col-start-3 sm:row-start-1"
        >
          <span className="text-right">
            <span className="block transition-colors group-hover:text-primary-emphasis">
              {tb.olderTrips}
            </span>
            <small className="block text-[11.5px] font-normal text-muted-foreground tabular-nums">
              {view.older.range}
            </small>
          </span>
          <span
            aria-hidden="true"
            className="grid size-8.5 place-items-center rounded-full border border-border bg-background transition-colors group-hover:bg-muted"
          >
            <ArrowRightIcon className="size-4" />
          </span>
        </Link>
      )}
    </nav>
  );
}
