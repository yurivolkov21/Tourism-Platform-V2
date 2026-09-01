'use client';

import { BookingStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { type BookingsQuery, bookingsHref } from '@/lib/bookings-query';

/**
 * Hai mẩu điều khiển của `/bookings`, lắp vào hai khe của `DataTableFrame`:
 * tab lọc trạng thái (khe trái — cặp Select/Tabs responsive nằm ở kit
 * `StatusFilterTabs`, nâng lên ở review F3 31/08) và ô tìm kiếm (khe phải).
 * Chúng chỉ làm một việc: đổi URL; server component đọc lại `searchParams`
 * rồi fetch (spec P4b §2.2), không có state danh sách nào ở client.
 */
const t = messages.admin.bookings.list;

/** Nguồn danh sách trạng thái = enum contract, không chép tay lần hai. */
const STATUSES = BookingStatusSchema.options;

const TAB_ITEMS = [
  { label: t.all, value: ALL },
  ...STATUSES.map((status) => ({ label: messages.admin.bookings.status[status], value: status })),
];

export function BookingsStatusTabs({ query }: { query: BookingsQuery }) {
  const router = useRouter();
  const value = query.status ?? ALL;

  function go(next: string) {
    // `safeParse` chứ không `parse`: cùng nếp khoan dung với đường URL
    // (`parseBookingsSearchParams`) — value lạ từ Select/Tabs (kể cả `null`
    // khi bị reset) rơi êm về "All" thay vì ném ZodError giữa event handler.
    const parsed = BookingStatusSchema.safeParse(next);
    router.push(bookingsHref(query, { status: parsed.success ? parsed.data : null }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.filterLabel}
      selectId="bookings-status-selector"
      onSelect={go}
    />
  );
}

export function BookingsSearch({ query }: { query: BookingsQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="bookings-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      clearLabel={t.clear}
      value={query.search}
      onSearch={(term) => router.push(bookingsHref(query, { search: term }))}
      onClear={() => router.push(bookingsHref(query, { search: null }))}
    />
  );
}
