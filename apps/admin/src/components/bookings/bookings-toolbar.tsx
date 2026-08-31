'use client';

import { BookingStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { cn } from '@tourism/ui/lib/utils';
import { SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type BookingsQuery, bookingsHref } from '@/lib/bookings-query';

/**
 * Thanh lọc của `/bookings`: tab trạng thái + ô tìm kiếm. Cả hai chỉ làm MỘT
 * việc — đổi URL; server component đọc lại `searchParams` rồi fetch (spec P4b
 * §2.2), nên không có state danh sách nào ở client.
 *
 * Tab là `<Link>` (không phải nút set-state): mỗi bộ lọc là một địa chỉ chia
 * sẻ được, và chuyển tab không cần JS chạy xong mới thấy kết quả.
 */
const t = messages.admin.bookings.list;

/** Nguồn danh sách trạng thái = enum contract, không chép tay lần hai. */
const STATUSES = BookingStatusSchema.options;

export function BookingsToolbar({ query }: { query: BookingsQuery }) {
  const router = useRouter();

  function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    router.push(bookingsHref(query, { search: String(form.get('q') ?? '') }));
  }

  return (
    <div className="flex flex-col gap-3 px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <nav aria-label={t.filterLabel} className="flex flex-wrap items-center gap-1">
        <FilterTab href={bookingsHref(query, { status: null })} active={!query.status}>
          {t.all}
        </FilterTab>
        {STATUSES.map((status) => (
          <FilterTab
            key={status}
            href={bookingsHref(query, { status })}
            active={query.status === status}
          >
            {messages.admin.bookings.status[status]}
          </FilterTab>
        ))}
      </nav>

      <form onSubmit={onSearch} className="flex items-center gap-2">
        <Label htmlFor="bookings-search" className="sr-only">
          {t.searchLabel}
        </Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="bookings-search"
            name="q"
            type="search"
            // Không kiểm soát bằng state: `key` ép React dựng lại ô sau mỗi
            // lần điều hướng, nên ô luôn khớp URL mà không cần effect đồng bộ.
            key={query.search ?? ''}
            defaultValue={query.search ?? ''}
            placeholder={t.searchPlaceholder}
            className="h-8 w-full pl-8 lg:w-64"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          {t.search}
        </Button>
        {query.search ? (
          <Link
            href={bookingsHref(query, { search: null })}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t.clear}
          </Link>
        ) : null}
      </form>
    </div>
  );
}

/** Một tab lọc — link, `aria-current` cho tab đang chọn. */
function FilterTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}
