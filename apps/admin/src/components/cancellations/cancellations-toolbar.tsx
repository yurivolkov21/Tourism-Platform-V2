'use client';

import { CancellationRequestStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { type CancellationsQuery, cancellationsHref } from '@/lib/cancellations-query';

/**
 * Bộ lọc trạng thái của `/cancellations` — cặp Select/Tabs responsive nằm ở
 * kit (`StatusFilterTabs`, nâng lên ở review F3 31/08); ở đây chỉ còn phần
 * riêng của vùng: enum + nhãn + cách đổi URL (spec P4b §2.2 — đổi filter là
 * điều hướng, không state danh sách nào ở client).
 */
const t = messages.admin.cancellations.list;

/** Nguồn danh sách trạng thái = enum contract, không chép tay lần hai. */
const STATUSES = CancellationRequestStatusSchema.options;

const TAB_ITEMS = [
  { label: t.all, value: ALL },
  ...STATUSES.map((status) => ({
    label: messages.admin.cancellations.status[status],
    value: status,
  })),
];

export function CancellationsStatusTabs({ query }: { query: CancellationsQuery }) {
  const router = useRouter();
  const value = query.status ?? ALL;

  function go(next: string) {
    // `safeParse` chứ không `parse`: value lạ từ Select/Tabs rơi êm về "All"
    // thay vì ném ZodError giữa event handler (nếp bookings, review F1).
    const parsed = CancellationRequestStatusSchema.safeParse(next);
    router.push(cancellationsHref(query, { status: parsed.success ? parsed.data : null }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.filterLabel}
      selectId="cancellations-status-selector"
      onSelect={go}
    />
  );
}
