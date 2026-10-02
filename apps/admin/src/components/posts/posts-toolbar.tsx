'use client';

import { messages } from '@tourism/i18n';
import { CalendarClockIcon, CircleCheckIcon, ListIcon, PencilLineIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL } from '@/components/kit/filter-value';
import { StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { type PostsQuery, parsePostsStatus, postsHref } from '@/lib/posts-query';

/**
 * Ba mẩu điều khiển của `/posts` (spec P4e-4 §4.2). Cả ba chỉ đổi URL; server component
 * đọc lại `searchParams` rồi fetch — không có state danh sách nào ở client.
 */
const t = messages.admin.posts.list;

const TAB_ITEMS = [
  { label: t.statusAll, value: ALL, icon: ListIcon },
  { label: t.statusPublished, value: 'published', icon: CircleCheckIcon },
  { label: t.statusScheduled, value: 'scheduled', icon: CalendarClockIcon },
  { label: t.statusDraft, value: 'draft', icon: PencilLineIcon },
];

export function PostsStatusTabs({ query }: { query: PostsQuery }) {
  const router = useRouter();
  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={query.status ?? ALL}
      label={t.statusLabel}
      selectId="posts-status-selector"
      // Giá trị lạ (ALL, hay value bị reset) rơi êm về tab All — nếp bảng Tours.
      onSelect={(next) => router.push(postsHref(query, { status: parsePostsStatus(next) }))}
    />
  );
}

export function PostsSearch({ query }: { query: PostsQuery }) {
  const router = useRouter();
  return (
    <TableSearchForm
      inputId="posts-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      value={query.search}
      onSearch={(term) => router.push(postsHref(query, { search: term }))}
    />
  );
}

/**
 * Nút xoá bộ lọc — vỏ mỏng quanh kit `ToolbarClearFilters`. KHÔNG đụng dải tab: nó tự có
 * mục All, cùng lý do với `/tours`. Hai href ghim `page: 1` để nút tự ẩn khi không lọc.
 */
export function PostsClearFilters({ query }: { query: PostsQuery }) {
  const router = useRouter();
  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        postsHref(query, { search: null, page: 1 }),
        postsHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
