'use client';

import { OutboxStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { BanIcon, CircleCheckIcon, CircleXIcon, ClockIcon, ListIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { type OutboxQuery, outboxHref } from '@/lib/outbox-query';

/**
 * Hai mẩu điều khiển của `/outbox` (spec P4c §3-F7): tab trạng thái (khe trái
 * — kit `StatusFilterTabs`) và ô tìm dedupeKey (khe phải). Cả hai chỉ làm một
 * việc: đổi URL; server component đọc lại `searchParams` rồi fetch (spec P4b
 * §2.2), không có state danh sách nào ở client.
 *
 * Mẩu thứ ba — lọc theo loại email — tách sang `outbox-type-menu.tsx` ngày
 * 03/09: nó thôi là Select và thành menu theo khuôn `dropdown-menu-10`, đủ
 * nặng để đứng riêng một file.
 */
const t = messages.admin.outbox;

/** Nguồn danh sách = enum contract, không chép tay lần hai. */
const STATUSES = OutboxStatusSchema.options;

/**
 * Icon theo trạng thái — `Record` trên enum để quên một member là đỏ ở
 * typecheck. PENDING là "đang xếp hàng" (đồng hồ), SENT tích, FAILED gạch.
 */
const STATUS_ICONS: Record<(typeof STATUSES)[number], typeof ClockIcon> = {
  PENDING: ClockIcon,
  SENT: CircleCheckIcon,
  FAILED: CircleXIcon,
  // Cố ý không gửi (người nhận đã huỷ đăng ký) — vạch chéo, không phải X đỏ.
  SKIPPED: BanIcon,
};

const TAB_ITEMS = [
  { label: t.list.all, value: ALL, icon: ListIcon },
  ...STATUSES.map((status) => ({
    label: t.status[status],
    value: status,
    icon: STATUS_ICONS[status],
  })),
];

export function OutboxStatusTabs({ query }: { query: OutboxQuery }) {
  const router = useRouter();
  const value = query.status ?? ALL;

  function go(next: string) {
    // `safeParse` chứ không `parse`: value lạ từ Select/Tabs rơi êm về "All"
    // thay vì ném ZodError giữa event handler (nếp bookings, review F1).
    const parsed = OutboxStatusSchema.safeParse(next);
    router.push(outboxHref(query, { status: parsed.success ? parsed.data : null }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.list.filterLabel}
      selectId="outbox-status-selector"
      onSelect={go}
    />
  );
}

export function OutboxSearch({ query }: { query: OutboxQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="outbox-search"
      label={t.list.searchLabel}
      placeholder={t.list.searchPlaceholder}
      value={query.search}
      onSearch={(term) => router.push(outboxHref(query, { search: term }))}
    />
  );
}

/**
 * Nút xoá DUY NHẤT của hàng điều khiển `/outbox` (05/09) — vỏ mỏng quanh kit
 * `ToolbarClearFilters`, xem JSDoc ở đó cho luật chung.
 *
 * Không đụng dải tab trạng thái (`status`): nó nằm ở khe `views`, tự đã có mục "All", và
 * sidebar link thẳng vào những URL mang nó.
 *
 * Hai href đều GHIM `page: 1` — không ghim thì từ trang 2 trở đi chúng khác
 * nhau chỉ vì `page` và nút không bao giờ tự ẩn.
 */
export function OutboxClearFilters({ query }: { query: OutboxQuery }) {
  const router = useRouter();

  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        outboxHref(query, { search: null, type: null, page: 1 }),
        outboxHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
