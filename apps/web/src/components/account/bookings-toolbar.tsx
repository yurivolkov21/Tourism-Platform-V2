'use client';

import {
  BOOKINGS_SEARCH_MAX,
  BookingStatusSchema,
  type BookingStatusValue,
  type BookingsListFacets,
  type BookingWhen,
  BookingWhenSchema,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { SearchIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useEffect, useOptimistic, useRef, useState } from 'react';
import {
  BOOKINGS_LIST_PATH,
  type BookingsListParams,
  bookingsListHref,
  EMPTY_BOOKINGS_LIST_PARAMS,
  hasListFilters,
  searchTermOf,
  toggleValue,
} from '@/lib/bookings-list';
import { FacetFilter, type FacetFilterOption } from './facet-filter';

/** Gõ xong bao lâu thì áp ô tìm (spec P7 §7.2); Enter áp ngay. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Id của ô tìm — nút Reset của trạng thái "No trips match" trả tiêu điểm về đây. */
export const BOOKINGS_SEARCH_ID = 'bookings-search';

/**
 * Hàng tìm và lọc của My bookings (spec P7 §7.2, bản vẽ `booking-list.src.html` phần 1).
 * Trạng thái THẬT nằm trên URL: mọi thay đổi thay URL bằng `router.replace` (không làm dài
 * lịch sử), đưa `page` về 1, rồi server lọc và trả trang mới. Không có nút Sort (ADR-0054 §4).
 *
 * Ba chỗ phải để ý:
 *
 * 1. **Ô tích đổi ngay khi bấm**: `useOptimistic` trong `startTransition`, khuôn "Filter with
 *    pending feedback" của tài liệu Next 16 (`01-app/02-guides/interactive-apps.md`). Giá trị
 *    lạc quan đứng tới khi lượt điều hướng xong rồi về đúng `params` mới của server.
 * 2. **Ô tìm có state riêng** (chữ đang gõ); chỉ đẩy lên URL sau 300 ms hoặc khi Enter.
 * 3. **URL đổi từ NGOÀI** (nút Back/Forward, nút Reset của trạng thái "No trips match") thì ô tìm
 *    theo URL và lượt tìm còn chờ bị HUỶ — nó thuộc về URL cũ, chạy tiếp là router.replace đè lên
 *    mục lịch sử khách vừa quay về (review 06/10). Còn lượt tìm của CHÍNH ô này về tới thì không
 *    được đè chữ khách đang gõ dở. `sentQ` nhớ từ khoá vừa gửi để phân biệt hai ca.
 */
export function BookingsToolbar({
  params,
  facets,
}: {
  params: BookingsListParams;
  facets: BookingsListFacets;
}) {
  const tb = messages.accountBookings;
  const statusLabels = messages.booking.list.status;
  const router = useRouter();
  const [current, setCurrent] = useOptimistic(params);
  const [query, setQuery] = useState(params.q ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentQ = useRef(params.q);

  useEffect(() => {
    if (params.q !== sentQ.current) {
      clearPendingTimer(timer);
      sentQ.current = params.q;
      setQuery(params.q ?? '');
    }
  }, [params.q]);

  useEffect(() => {
    // Back/Forward: huỷ lượt tìm còn chờ NGAY và cho ô tìm theo URL vừa khôi phục — lượt khôi
    // phục phải tải lại thì `params` về muộn hơn 300 ms, hẹn giờ sẽ kịp chạy trước.
    const onPopState = () => {
      clearPendingTimer(timer);
      const q = searchTermOf(new URLSearchParams(window.location.search).get('q') ?? '');
      sentQ.current = q;
      setQuery(q ?? '');
    };
    window.addEventListener('popstate', onPopState);
    // Rời trang khi còn lượt tìm đang chờ: huỷ, không điều hướng từ một trang đã đóng.
    return () => {
      window.removeEventListener('popstate', onPopState);
      clearPendingTimer(timer);
    };
  }, []);

  function cancelPendingSearch() {
    clearPendingTimer(timer);
  }

  function navigate(next: BookingsListParams) {
    cancelPendingSearch();
    // Mọi thay đổi lọc hay tìm đưa về trang 1 (spec §7.2): giữ trang cũ là cách chắc nhất
    // để ra một trang trắng.
    const target = { ...next, page: 1 };
    sentQ.current = target.q;
    startTransition(() => {
      setCurrent(target);
      router.replace(bookingsListHref(target), { scroll: false });
    });
  }

  function applySearch(text: string) {
    const q = searchTermOf(text);
    if (q === current.q) {
      cancelPendingSearch();
      return;
    }
    navigate({ ...current, q });
  }

  function onQueryChange(text: string) {
    setQuery(text);
    cancelPendingSearch();
    timer.current = setTimeout(() => applySearch(text), SEARCH_DEBOUNCE_MS);
  }

  // Nút ✕ và Reset biến mất ngay sau cú bấm — đưa tiêu điểm về ô tìm, không để rơi về `<body>`.
  function clearSearch() {
    setQuery('');
    inputRef.current?.focus();
    applySearch('');
  }

  function reset() {
    setQuery('');
    inputRef.current?.focus();
    navigate(EMPTY_BOOKINGS_LIST_PARAMS);
  }

  /** Lọc kèm chữ đang gõ dở: một lần bấm áp cả hai, không bỏ rơi từ khoá chưa kịp gửi. */
  function filterBy(patch: Partial<BookingsListParams>) {
    navigate({ ...current, q: searchTermOf(query), ...patch });
  }

  const whenOptions: FacetFilterOption<BookingWhen>[] = BookingWhenSchema.options.map((value) => ({
    value,
    label: tb.whenOptions[value],
    count: facets.when[value],
  }));
  // Status: chỉ trạng thái có đơn, cộng trạng thái đang chọn (spec §2.7) — một lựa chọn đã
  // chọn mà biến khỏi menu là khách không bỏ chọn được.
  const statusOptions: FacetFilterOption<BookingStatusValue>[] = BookingStatusSchema.options
    .filter((value) => facets.status[value] > 0 || current.status.includes(value))
    .map((value) => ({
      value,
      label: statusLabels[value] ?? value,
      count: facets.status[value],
    }));
  const showReset = hasListFilters(current) || searchTermOf(query) !== null;

  return (
    // Điện thoại (spec §7.2): ô tìm chiếm hàng đầu; hai nút lọc chia đôi hàng hai; Reset chỉ
    // còn icon. Từ `sm`: cỡ cố định của bản vẽ — cao 36, ô tìm 290, hai nút lọc 176.
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative w-full sm:w-[290px]"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(query);
        }}
      >
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          id={BOOKINGS_SEARCH_ID}
          type="search"
          value={query}
          maxLength={BOOKINGS_SEARCH_MAX}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={tb.searchPlaceholder}
          aria-label={tb.searchPlaceholder}
          className="h-9 bg-background pr-9 pl-9 text-[13px] [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query === '' ? null : (
          // Bọc trong `span` định vị: `translate` của chính nút sẽ đụng hiệu ứng nhấn
          // `active:translate-y-px` của `Button`.
          <span className="absolute inset-y-0 right-1 flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tb.clearSearch}
              onClick={clearSearch}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </span>
        )}
      </form>
      <FacetFilter
        label={tb.whenFilter}
        options={whenOptions}
        selected={current.when}
        onToggle={(value) => filterBy({ when: toggleValue(current.when, value) })}
        onClear={() => filterBy({ when: [] })}
        className="flex-1 sm:w-44 sm:flex-none"
      />
      <FacetFilter
        label={tb.statusFilter}
        options={statusOptions}
        selected={current.status}
        onToggle={(value) => filterBy({ status: toggleValue(current.status, value) })}
        onClear={() => filterBy({ status: [] })}
        className="flex-1 sm:w-44 sm:flex-none"
      />
      {showReset ? (
        <Button
          type="button"
          variant="ghost"
          onClick={reset}
          className="h-9 gap-1.5 px-2.5 text-[13px] font-semibold"
        >
          <span className="sr-only sm:not-sr-only">{tb.reset}</span>
          <XIcon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

/** Huỷ lượt tìm đang chờ (nếu có). */
function clearPendingTimer(timer: { current: ReturnType<typeof setTimeout> | null }) {
  if (timer.current !== null) {
    clearTimeout(timer.current);
    timer.current = null;
  }
}

/**
 * Nút Reset của trạng thái "No trips match" (spec P7 §7.3) — cùng hành vi Reset của hàng lọc:
 * `router.replace` về danh sách gốc (không thêm mục lịch sử, không tải lại trang) và trả tiêu
 * điểm cho ô tìm, vì chính nút này biến mất khi danh sách hiện lại. Bản link thường trước đây tải
 * lại cả trang và thêm một mục lịch sử (review 06/10).
 */
export function ResetFiltersButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      className="mt-6"
      onClick={() => {
        document.getElementById(BOOKINGS_SEARCH_ID)?.focus();
        router.replace(BOOKINGS_LIST_PATH, { scroll: false });
      }}
    >
      {messages.accountBookings.reset}
    </Button>
  );
}
