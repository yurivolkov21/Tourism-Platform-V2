'use client';

import { EnquiryStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  ListIcon,
  PhoneCallIcon,
  ReceiptTextIcon,
  XIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { type EnquiriesQuery, enquiriesHref } from '@/lib/enquiries-query';

/**
 * Ba mẩu điều khiển của `/enquiries` (spec P4c §3-F9): tab năm trạng thái +
 * All (khe trái — kit `StatusFilterTabs`), ô tìm name/email và chip lọc theo
 * tour (khe phải). Cả ba chỉ làm một việc: đổi URL; server component đọc lại
 * `searchParams` rồi fetch (spec P4b §2.2), không có state danh sách nào ở
 * client.
 */
const t = messages.admin.enquiries;

/** Nguồn danh sách = enum contract, không chép tay lần hai. */
const STATUSES = EnquiryStatusSchema.options;

/**
 * Icon theo trạng thái — `Record` trên enum để quên một member là đỏ ở
 * typecheck. Ba trạng thái đang mở kể tiến độ (chưa chạm · đã gọi · đã báo
 * giá), hai trạng thái chung cuộc là tích và gạch chéo.
 */
const STATUS_ICONS: Record<(typeof STATUSES)[number], typeof ListIcon> = {
  NEW: CircleDashedIcon,
  CONTACTED: PhoneCallIcon,
  QUOTED: ReceiptTextIcon,
  WON: CircleCheckIcon,
  LOST: CircleSlashIcon,
};

const TAB_ITEMS = [
  { label: t.list.all, value: ALL, icon: ListIcon },
  ...STATUSES.map((status) => ({
    label: t.status[status],
    value: status,
    icon: STATUS_ICONS[status],
  })),
];

export function EnquiriesStatusTabs({ query }: { query: EnquiriesQuery }) {
  const router = useRouter();
  const value = query.status ?? ALL;

  function go(next: string) {
    // `safeParse` chứ không `parse`: value lạ từ Select/Tabs rơi êm về "All"
    // thay vì ném ZodError giữa event handler (nếp bookings, review F1).
    const parsed = EnquiryStatusSchema.safeParse(next);
    router.push(enquiriesHref(query, { status: parsed.success ? parsed.data : null }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.list.filterLabel}
      selectId="enquiries-status-selector"
      onSelect={go}
    />
  );
}

export function EnquiriesSearch({ query }: { query: EnquiriesQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="enquiries-search"
      label={t.list.searchLabel}
      placeholder={t.list.searchPlaceholder}
      clearLabel={t.list.clear}
      value={query.search}
      onSearch={(term) => router.push(enquiriesHref(query, { search: term }))}
      onClear={() => router.push(enquiriesHref(query, { search: null }))}
    />
  );
}

/**
 * Chip "đang lọc theo tour" — KHÔNG phải một Select (quyết định tự chọn F9:
 * admin chưa có endpoint list tour tới P4e). `?tourId=` chỉ đến từ URL gõ tay
 * hoặc một trang khác link sang, nhưng nó vẫn lọc thật — nên nó phải NHÌN
 * THẤY được và gỡ được: một filter vô hình là một bảng thiếu hàng không giải
 * thích được. Không lọc theo tour thì không render gì.
 */
export function EnquiriesTourFilter({
  query,
  label,
}: {
  query: EnquiriesQuery;
  /** Tên tour do server tính (`tourFilterLabel`); null = không có filter nào. */
  label: string | null;
}) {
  const router = useRouter();
  if (!label) return null;

  return (
    <Badge variant="secondary" className="gap-1 py-1 pr-1 pl-2">
      <span className="max-w-40 truncate">{t.list.tourFilter(label)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-5"
        aria-label={t.list.tourFilterClear}
        onClick={() => router.push(enquiriesHref(query, { tourId: null }))}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </Badge>
  );
}
