'use client';

import { messages } from '@tourism/i18n';
import { CircleSlashIcon, ListIcon, MailCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { type SubscribersQuery, subscribersHref } from '@/lib/subscribers-query';

/**
 * Hai mẩu điều khiển của `/subscribers` (spec P4c §3-F10): tab Active/
 * Unsubscribed/All (khe trái — kit `StatusFilterTabs`) và ô tìm email (khe
 * phải). Cả hai chỉ làm một việc: đổi URL; server component đọc lại
 * `searchParams` rồi fetch (spec P4b §2.2), không có state danh sách nào ở
 * client.
 *
 * Mẩu thứ ba — lọc theo nguồn — tách sang `subscribers-source-menu.tsx` ngày
 * 03/09: nó thôi là Select và thành menu theo khuôn `dropdown-menu-10`.
 */
const t = messages.admin.subscribers.list;

/**
 * Ba tab = ba trạng thái của cờ `active`. Value trên tab là CHUỖI ('true'/
 * 'false'/ALL) vì `StatusFilterTabs` nói bằng chuỗi; chỗ đổi ngược về boolean
 * là `go()` bên dưới, một chỗ duy nhất.
 *
 * "All" giữ lại (quyết định tự chọn F10) chứ không rút còn hai tab: nó là
 * cách DUY NHẤT thấy trọn lịch sử một địa chỉ trên một màn hình khi tìm theo
 * email, và là tập mà nút Export dựng ra file "cả danh sách" — hai tab thì
 * không có đường nào xuất được một file đầy đủ.
 */
const TAB_ITEMS = [
  { label: t.all, value: ALL, icon: ListIcon },
  { label: t.active, value: 'true', icon: MailCheckIcon },
  { label: t.unsubscribed, value: 'false', icon: CircleSlashIcon },
];

export function SubscribersStatusTabs({ query }: { query: SubscribersQuery }) {
  const router = useRouter();
  const value = query.active === undefined ? ALL : String(query.active);

  function go(next: string) {
    // Value lạ từ Select/Tabs rơi êm về "All" thay vì ném giữa event handler
    // (nếp bookings, review F1).
    const active = next === 'true' ? true : next === 'false' ? false : null;
    router.push(subscribersHref(query, { active }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.filterLabel}
      selectId="subscribers-status-selector"
      onSelect={go}
    />
  );
}

export function SubscribersSearch({ query }: { query: SubscribersQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="subscribers-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      clearLabel={t.clear}
      value={query.search}
      onSearch={(term) => router.push(subscribersHref(query, { search: term }))}
      onClear={() => router.push(subscribersHref(query, { search: null }))}
    />
  );
}
