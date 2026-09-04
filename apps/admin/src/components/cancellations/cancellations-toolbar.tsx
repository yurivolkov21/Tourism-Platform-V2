'use client';

import { CancellationRequestStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { CircleCheckIcon, CircleXIcon, ClockIcon, ListIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { ToolbarDateRange } from '@/components/kit/toolbar-date-range';
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

/**
 * Icon cho từng trạng thái (user chốt 01/09) — cùng luật với `/bookings`:
 * `Record` trên enum để quên một member là đỏ ở typecheck.
 *
 * REFUNDED ở bảng này là "Approved — refunded", tức KẾT QUẢ ĐÃ DUYỆT của một
 * yêu cầu; nên nó lấy dấu tích đối lại dấu X của DENIED, chứ không lấy mũi
 * tên hoàn tiền như `/bookings`. Cặp duyệt/từ chối mới là thứ mắt cần tách ở
 * đây.
 */
const STATUS_ICONS: Record<(typeof STATUSES)[number], typeof ClockIcon> = {
  REQUESTED: ClockIcon,
  REFUNDED: CircleCheckIcon,
  DENIED: CircleXIcon,
};

const TAB_ITEMS = [
  { label: t.all, value: ALL, icon: ListIcon },
  ...STATUSES.map((status) => ({
    label: messages.admin.cancellations.status[status],
    value: status,
    icon: STATUS_ICONS[status],
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

/**
 * Khoảng ngày YÊU CẦU (ADR-0028 §AMEND) — vỏ mỏng quanh kit `ToolbarDateRange`,
 * consumer thứ hai của nó sau `/bookings`. Vùng chỉ giữ nhãn, tiền tố id và
 * cách dựng href; hai ô cùng guard "patch bị vứt" nằm ở kit.
 *
 * Lọc theo `createdAt` — ngày khách GỬI, nên chữ nói "Requested from/to" chứ
 * không phải "Booked". Cột ấy là chủ đích: hàng `REQUESTED` có `decidedAt`
 * null nên lọc theo ngày quyết sẽ quét sạch hàng đợi đang mở khỏi bảng.
 */
export function CancellationsDateRange({ query }: { query: CancellationsQuery }) {
  const router = useRouter();

  return (
    <ToolbarDateRange
      idPrefix="cancellations"
      label={t.dateFilterLabel}
      labels={{
        from: t.dateFrom,
        to: t.dateTo,
        openFrom: t.pickDateFrom,
        openTo: t.pickDateTo,
        placeholder: t.datePlaceholder,
        clear: t.clearDates,
      }}
      from={query.from}
      to={query.to}
      hrefFor={(patch) => cancellationsHref(query, patch)}
      onNavigate={router.push}
    />
  );
}
