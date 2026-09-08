'use client';

import { type ReviewModerationState, ReviewModerationStateSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  ListIcon,
  type LucideIcon,
  Undo2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { ToolbarDateRange } from '@/components/kit/toolbar-date-range';
import { parseReviewState, type ReviewsQuery, reviewsHref } from '@/lib/reviews-query';

/**
 * Hai mẩu điều khiển của `/reviews`, lắp vào hai khe của `DataTableFrame`:
 * bộ lọc trạng thái duyệt (khe trái — cặp Select/Tabs responsive của kit) và
 * ô tìm kiếm (khe phải, cùng khuôn `/bookings`). Chúng chỉ làm một việc: đổi
 * URL; server component đọc lại `searchParams` rồi fetch (spec P4b §2.2),
 * không có state danh sách nào ở client.
 *
 * Ô tìm kiếm CÓ ở vùng này (khác `/cancellations`) vì `AdminReviewsQuerySchema`
 * thật sự khai `search` và service lọc free-text trên body/title/tên tác giả —
 * ngược lại với luật "đừng dựng ô tìm kiếm giả cho tham số server không đọc".
 */
const t = messages.admin.reviews.list;

/**
 * Icon theo trạng thái — `Record` trên CHÍNH enum contract (vòng vá review
 * W4): thêm trạng thái vào contract mà quên tab là typecheck đỏ, không phải
 * một tab âm thầm thiếu (W4 U2 thêm `retracted` mà bản đầu không có tab —
 * review tác giả đã rút không lọc ra được từ URL). Icon dùng CHUNG bộ với
 * hai bảng kia (user chốt 01/09): cùng một khái niệm thì cùng một glyph.
 */
const STATE_ICONS: Record<ReviewModerationState, LucideIcon> = {
  pending: ClockIcon,
  approved: CircleCheckIcon,
  rejected: CircleXIcon,
  retracted: Undo2Icon,
};

const TAB_ITEMS = [
  { label: t.all, value: ALL, icon: ListIcon },
  // Thứ tự theo enum contract: chờ duyệt đứng TRƯỚC đã duyệt — đó là việc
  // cần làm, và cũng là thứ mục sidebar mở thẳng vào (`/reviews?status=pending`).
  ...ReviewModerationStateSchema.options.map((state) => ({
    label: messages.admin.reviews.state[state],
    value: state,
    icon: STATE_ICONS[state],
  })),
];

export function ReviewsStateTabs({ query }: { query: ReviewsQuery }) {
  const router = useRouter();
  const value = query.state ?? ALL;

  function go(next: string) {
    // `parseReviewState` trả null cho mọi giá trị lạ (kể cả ALL) — cùng hàm
    // đường URL dùng, nên tab và URL không thể hiểu khác nhau.
    router.push(reviewsHref(query, { state: parseReviewState(next) }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.filterLabel}
      selectId="reviews-state-selector"
      onSelect={go}
    />
  );
}

export function ReviewsSearch({ query }: { query: ReviewsQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="reviews-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      value={query.search}
      onSearch={(term) => router.push(reviewsHref(query, { search: term }))}
    />
  );
}

/**
 * Khoảng ngày GỬI review (ADR-0028 §AMEND 2) — vỏ mỏng quanh kit
 * `ToolbarDateRange`, consumer thứ ba sau `/bookings` và `/cancellations`.
 *
 * Lọc theo `createdAt`, nên chữ nói "Submitted from/to". KHÔNG lọc theo
 * `moderatedAt` dù nó khớp tuyệt đối với card Approved: review chưa duyệt có
 * `moderatedAt` null, nên lọc cột ấy sẽ quét sạch hàng đợi khỏi bảng — tức
 * xoá mất lý do tồn tại của trang.
 *
 * Vùng này mặc định KHÔNG lọc ngày (hai ô trống), giống `/cancellations`:
 * hàng đợi việc phải làm thì mở ra phải thấy đủ, kể cả review gửi tháng trước.
 */
export function ReviewsDateRange({ query }: { query: ReviewsQuery }) {
  const router = useRouter();

  return (
    <ToolbarDateRange
      idPrefix="reviews"
      label={t.dateFilterLabel}
      from={query.from}
      to={query.to}
      hrefFor={(patch) => reviewsHref(query, patch)}
      onNavigate={router.push}
    />
  );
}

/**
 * Nút xoá DUY NHẤT của hàng điều khiển `/reviews` (05/09) — vỏ mỏng quanh kit
 * `ToolbarClearFilters`, xem JSDoc ở đó cho luật chung.
 *
 * Không đụng dải tab trạng thái (`state`): nó nằm ở khe `views`, tự đã có mục "All", và
 * sidebar link thẳng vào những URL mang nó.
 *
 * Hai href đều GHIM `page: 1` — không ghim thì từ trang 2 trở đi chúng khác
 * nhau chỉ vì `page` và nút không bao giờ tự ẩn.
 */
export function ReviewsClearFilters({ query }: { query: ReviewsQuery }) {
  const router = useRouter();

  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        reviewsHref(query, {
          search: null,
          from: null,
          to: null,
          source: null,
          rating: null,
          page: 1,
        }),
        reviewsHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
