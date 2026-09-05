'use client';

import { messages } from '@tourism/i18n';
import { CircleCheckIcon, CircleXIcon, ClockIcon, ListIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
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

const TAB_ITEMS = [
  { label: t.all, value: ALL, icon: ListIcon },
  // Chờ duyệt đứng TRƯỚC đã duyệt: đó là việc cần làm, và cũng là thứ mục
  // sidebar mở thẳng vào (`/reviews?status=pending`).
  // Icon dùng CHUNG bộ với hai bảng kia (user chốt 01/09): cùng một khái niệm
  // thì cùng một glyph, kẻo mỗi bảng dạy lại admin một bảng chữ cái.
  { label: messages.admin.reviews.state.pending, value: 'pending', icon: ClockIcon },
  { label: messages.admin.reviews.state.approved, value: 'approved', icon: CircleCheckIcon },
  // ADR-0031: tab thứ ba mới có nghĩa — trước đó "đã bác" không tồn tại như
  // một trạng thái, nó lẫn vào "chờ duyệt" và không lọc ra được.
  { label: messages.admin.reviews.state.rejected, value: 'rejected', icon: CircleXIcon },
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
      clearLabel={t.clear}
      value={query.search}
      onSearch={(term) => router.push(reviewsHref(query, { search: term }))}
      onClear={() => router.push(reviewsHref(query, { search: null }))}
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
      labels={{
        from: t.dateFrom,
        to: t.dateTo,
        openFrom: t.pickDateFrom,
        openTo: t.pickDateTo,
        placeholder: t.datePlaceholder,
        clear: t.clearDates,
      }}
      from={query.from}
      to={query.to}
      hrefFor={(patch) => reviewsHref(query, patch)}
      onNavigate={router.push}
    />
  );
}
