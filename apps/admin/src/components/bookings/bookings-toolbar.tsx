'use client';

import { BookingStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { Tabs, TabsList, TabsTrigger } from '@tourism/ui/components/tabs';
import { SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type BookingsQuery, bookingsHref } from '@/lib/bookings-query';

/**
 * Hai mẩu điều khiển của `/bookings`, lắp vào hai khe của `DataTableFrame`:
 * tab lọc trạng thái (khe trái) và ô tìm kiếm (khe phải).
 *
 * Tab dùng ĐÚNG `Tabs/TabsList/TabsTrigger` như block dashboard-01 — kể cả
 * cặp "TabsList ở màn rộng · Select ở màn hẹp" (`@4xl/main`) — để hai bảng
 * nhìn là một hệ (user chốt 31/08). Chúng chỉ làm một việc: đổi URL; server
 * component đọc lại `searchParams` rồi fetch (spec P4b §2.2), không có state
 * danh sách nào ở client.
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
    router.push(
      bookingsHref(query, { status: next === ALL ? null : BookingStatusSchema.parse(next) }),
    );
  }

  return (
    <>
      <Label htmlFor="status-selector" className="sr-only">
        {t.filterLabel}
      </Label>
      {/* Màn hẹp: select gọn — cùng cặp @4xl/main của block dashboard-01. */}
      <Select value={value} onValueChange={(next) => go(String(next))} items={TAB_ITEMS}>
        <SelectTrigger className="flex w-fit @4xl/main:hidden" size="sm" id="status-selector">
          <SelectValue placeholder={t.all} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TAB_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Ẩn/hiện đặt ở ROOT chứ không ở TabsList: root là con trực tiếp của
          hàng `justify-between`, để nó luôn hiện thì màn hẹp có một khối rỗng
          chen giữa select và cụm hành động. */}
      <Tabs
        value={value}
        onValueChange={(next) => go(String(next))}
        aria-label={t.filterLabel}
        className="hidden @4xl/main:flex"
      >
        <TabsList>
          {TAB_ITEMS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </>
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
