'use client';

import { messages } from '@tourism/i18n';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { BOOKINGS_COUNT_ID, type BookingsListParams, pagerView } from '@/lib/bookings-list';

/**
 * Phân trang "Previous / Next" của My bookings (spec P7 §7.4, bản vẽ `booking-list.src.html`
 * kiểu 3 — nhãn "Newer / Older trips" của bản vẽ đổi 06/10: thứ tự hành trình xếp chuyến sắp đi từ
 * gần tới xa, nên ở đoạn ấy "Older" từng dẫn tới chuyến đi xa hơn). Link thường — vào lịch sử
 * trình duyệt, khác `router.replace` của hàng lọc — và giữ nguyên bộ lọc.
 *
 * Tiêu điểm (review 06/10): bấm Next tới trang cuối thì chính link ấy bị gỡ, tiêu điểm rơi về
 * `<body>`. Trang mới về sau cú bấm thì tiêu điểm về dòng đếm ở đầu danh sách mới — chỗ đọc tiếp
 * tự nhiên, nằm sẵn trong vùng Next vừa cuộn lên. Trang đổi vì lý do khác (lọc, nút Back) thì
 * không giật tiêu điểm.
 *
 * Điện thoại: dòng "Page … of …" lên hàng trên, hai link xuống hàng dưới; từ `sm` là ba phần
 * một hàng như bản vẽ. Vị trí đặt bằng lưới, DOM giữ thứ tự đọc Previous → tóm tắt → Next.
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
  const navigated = useRef(false);
  const summary = view?.summary;

  useEffect(() => {
    // `summary` đổi = trang mới đã về; chỉ dời tiêu điểm khi chính phân trang đưa khách sang.
    if (summary === undefined || !navigated.current) return;
    navigated.current = false;
    document.getElementById(BOOKINGS_COUNT_ID)?.focus();
  }, [summary]);

  if (view === null) return null;
  const tb = messages.accountBookings;
  const onNavigate = () => {
    navigated.current = true;
  };
  const previousClass =
    'col-start-1 row-start-2 inline-flex items-center gap-2 justify-self-start font-semibold sm:row-start-1';

  return (
    <nav
      aria-label={tb.pagerAria}
      className="mt-4 grid grid-cols-2 items-center gap-y-3 border-t border-border pt-3.5 text-[13.5px] sm:grid-cols-[1fr_auto_1fr]"
    >
      {view.previousHref === null ? (
        <span aria-disabled="true" className={`${previousClass} text-muted-foreground/45`}>
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {tb.previousPage}
        </span>
      ) : (
        <Link
          href={view.previousHref}
          onClick={onNavigate}
          className={`${previousClass} transition-colors hover:text-primary-emphasis`}
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {tb.previousPage}
        </Link>
      )}
      <p className="col-span-2 col-start-1 row-start-1 text-center text-[13px] text-muted-foreground tabular-nums sm:col-span-1 sm:col-start-2">
        {view.summary}
      </p>
      {view.next === null ? null : (
        <Link
          href={view.next.href}
          onClick={onNavigate}
          aria-label={tb.nextPageAria(view.next.range)}
          className="group col-start-2 row-start-2 inline-flex items-center gap-2.5 justify-self-end font-semibold sm:col-start-3 sm:row-start-1"
        >
          <span className="text-right">
            <span className="block transition-colors group-hover:text-primary-emphasis">
              {tb.nextPage}
            </span>
            <small className="block text-[11.5px] font-normal text-muted-foreground tabular-nums">
              {view.next.range}
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
