'use client';

import { messages } from '@tourism/i18n';
import { ListIcon, LockIcon, ShieldCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { type UsersFilterView, type UsersQuery, usersHref } from '@/lib/users-query';

/**
 * Ba mẩu điều khiển của `/users` (P4f): tab All · Staff · Locked (khe trái — kit
 * `StatusFilterTabs`), ô tìm tên/email và nút xoá lọc (khe phải). Cả ba chỉ đổi URL.
 */
const t = messages.admin.users.list;

const TAB_ITEMS = [
  { label: t.all, value: ALL, icon: ListIcon },
  { label: t.staff, value: 'staff', icon: ShieldCheckIcon },
  { label: t.locked, value: 'locked', icon: LockIcon },
];

function asView(value: string): UsersFilterView | null {
  return value === 'staff' || value === 'locked' ? value : null;
}

export function UsersViewTabs({ query }: { query: UsersQuery }) {
  const router = useRouter();
  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={query.view ?? ALL}
      label={t.filterLabel}
      selectId="users-view-selector"
      onSelect={(next) => router.push(usersHref(query, { view: asView(next) }))}
    />
  );
}

export function UsersSearch({ query }: { query: UsersQuery }) {
  const router = useRouter();
  return (
    <TableSearchForm
      inputId="users-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      value={query.search}
      onSearch={(term) => router.push(usersHref(query, { search: term }))}
    />
  );
}

/** Không đụng tab (`view`): nó nằm ở khe `views` và tự có mục All. */
export function UsersClearFilters({ query }: { query: UsersQuery }) {
  const router = useRouter();
  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        usersHref(query, { search: null, page: 1 }),
        usersHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
