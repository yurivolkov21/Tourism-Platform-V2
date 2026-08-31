'use client';

import { BookingStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StatusFilterTabs } from '@/components/kit/status-filter-tabs';
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

/** Giá trị tab "tất cả" — Select/Tabs cần một value thật, URL thì bỏ trống. */
const ALL = 'ALL';

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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    router.push(bookingsHref(query, { search: String(form.get('q') ?? '') }));
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Label htmlFor="bookings-search" className="sr-only">
        {t.searchLabel}
      </Label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="bookings-search"
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
          onClick={() => router.push(bookingsHref(query, { search: null }))}
        >
          {t.clear}
        </Button>
      ) : null}
    </form>
  );
}
