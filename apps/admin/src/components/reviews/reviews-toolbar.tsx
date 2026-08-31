'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
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
  { label: t.all, value: ALL },
  // Chờ duyệt đứng TRƯỚC đã duyệt: đó là việc cần làm, và cũng là thứ mục
  // sidebar mở thẳng vào (`/reviews?status=pending`).
  { label: messages.admin.reviews.state.pending, value: 'pending' },
  { label: messages.admin.reviews.state.approved, value: 'approved' },
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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    router.push(reviewsHref(query, { search: String(form.get('q') ?? '') }));
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Label htmlFor="reviews-search" className="sr-only">
        {t.searchLabel}
      </Label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="reviews-search"
          name="q"
          type="search"
          // Không kiểm soát bằng state: `key` ép React dựng lại ô sau mỗi lần
          // điều hướng, nên ô luôn khớp URL mà không cần effect đồng bộ.
          key={query.search ?? ''}
          defaultValue={query.search ?? ''}
          placeholder={t.searchPlaceholder}
          className="w-40 pl-8 lg:w-56"
        />
      </div>
      {query.search ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push(reviewsHref(query, { search: null }))}
        >
          {t.clear}
        </Button>
      ) : null}
    </form>
  );
}
