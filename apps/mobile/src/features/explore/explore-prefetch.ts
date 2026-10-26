import type { QueryClient } from '@tanstack/react-query';
import { orpc } from '@/lib/api/client';
import type { SortKey } from './filter-sheet';

/**
 * Sort chạy SERVER (handoff §6.1): đúng 4 kiểu `toursPage.sortOptions` — API
 * đỡ đủ. KHÔNG dùng `mobile.explore.sort` (popular/rating), bị bỏ có chủ ý.
 */
export const SORT_PARAMS: Record<
  SortKey,
  { sort: 'createdAt' | 'basePrice' | 'durationDays'; order: 'asc' | 'desc' }
> = {
  newest: { sort: 'createdAt', order: 'desc' },
  priceAsc: { sort: 'basePrice', order: 'asc' },
  priceDesc: { sort: 'basePrice', order: 'desc' },
  durationAsc: { sort: 'durationDays', order: 'asc' },
};

/**
 * Input `catalog.tours.list` của Explore — MỘT chỗ duy nhất để màn Explore và phần tải sẵn
 * từ Home cùng ra một query key (lệch một trường là cache không trúng).
 */
export function exploreToursInput({
  category = null,
  destination = null,
  sort = 'newest',
}: {
  category?: string | null;
  destination?: string | null;
  sort?: SortKey;
} = {}) {
  return {
    limit: 50,
    category: category ?? undefined,
    destination: destination ?? undefined,
    ...SORT_PARAMS[sort],
  };
}

/** Tải sẵn dữ liệu Explore (danh sách tour + danh mục) để mở tab là có thẻ ngay. */
export function prefetchExplore(queryClient: QueryClient, destination: string | null = null) {
  void queryClient.prefetchQuery(
    orpc.catalog.tours.list.queryOptions({ input: exploreToursInput({ destination }) }),
  );
  void queryClient.prefetchQuery(orpc.catalog.categories.list.queryOptions());
}
