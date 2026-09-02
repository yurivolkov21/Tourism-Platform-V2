'use client';

import { EmailTypeSchema, OutboxStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { BanIcon, CircleCheckIcon, CircleXIcon, ClockIcon, ListIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { ToolbarSelect } from '@/components/kit/toolbar-select';
import { type OutboxQuery, outboxHref } from '@/lib/outbox-query';

/**
 * Ba mẩu điều khiển của `/outbox` (spec P4c §3-F7): tab trạng thái (khe trái
 * — kit `StatusFilterTabs`), Select loại email và ô tìm dedupeKey (khe phải).
 * Cả ba chỉ làm một việc: đổi URL; server component đọc lại `searchParams`
 * rồi fetch (spec P4b §2.2), không có state danh sách nào ở client.
 */
const t = messages.admin.outbox;

/** Nguồn danh sách = enum contract, không chép tay lần hai. */
const STATUSES = OutboxStatusSchema.options;
const TYPES = EmailTypeSchema.options;

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

const TYPE_ITEMS = [
  { label: t.list.typeAll, value: ALL },
  ...TYPES.map((type) => ({ label: t.type[type], value: type })),
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

/**
 * Lọc theo loại email — Select (13 giá trị thì tab không vừa một hàng). Kit
 * `ToolbarSelect` (vòng vá review F7 — bản chép thứ ba của cùng khối Select
 * được nâng lên kit) nên đứng cạnh nhánh mobile của `StatusFilterTabs` là
 * cùng một control.
 */
export function OutboxTypeSelect({ query }: { query: OutboxQuery }) {
  const router = useRouter();
  const value = query.type ?? ALL;

  function go(next: string) {
    const parsed = EmailTypeSchema.safeParse(next);
    router.push(outboxHref(query, { type: parsed.success ? parsed.data : null }));
  }

  return (
    <ToolbarSelect
      id="outbox-type-selector"
      label={t.list.typeLabel}
      value={value}
      items={TYPE_ITEMS}
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
      clearLabel={t.list.clear}
      value={query.search}
      onSearch={(term) => router.push(outboxHref(query, { search: term }))}
      onClear={() => router.push(outboxHref(query, { search: null }))}
    />
  );
}
