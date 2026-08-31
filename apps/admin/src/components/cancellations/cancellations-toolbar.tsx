'use client';

import { CancellationRequestStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
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
import { useRouter } from 'next/navigation';
import { type CancellationsQuery, cancellationsHref } from '@/lib/cancellations-query';

/**
 * Khe trái của `DataTableFrame` cho `/cancellations`: tab lọc trạng thái —
 * cùng cặp "TabsList ở màn rộng · Select ở màn hẹp" (`@4xl/main`) như bảng
 * bookings và block dashboard-01, để mọi bảng admin nhìn là một hệ (user chốt
 * 31/08). Không có ô tìm kiếm: contract của vùng này không khai `search`.
 *
 * Nó chỉ làm một việc: đổi URL. Server component đọc lại `searchParams` rồi
 * fetch (spec §2.2) — không có state danh sách nào ở client.
 */
const t = messages.admin.cancellations.list;

/** Nguồn danh sách trạng thái = enum contract, không chép tay lần hai. */
const STATUSES = CancellationRequestStatusSchema.options;

/** Giá trị tab "tất cả" — Select/Tabs cần một value thật, URL thì bỏ trống. */
const ALL = 'ALL';

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
    // `safeParse` chứ không `parse`: value lạ từ Select/Tabs (kể cả `null` khi
    // bị reset) rơi êm về "All" thay vì ném ZodError giữa event handler.
    const parsed = CancellationRequestStatusSchema.safeParse(next);
    router.push(cancellationsHref(query, { status: parsed.success ? parsed.data : null }));
  }

  return (
    <>
      <Label htmlFor="cancellation-status-selector" className="sr-only">
        {t.filterLabel}
      </Label>
      <Select value={value} onValueChange={(next) => go(String(next))} items={TAB_ITEMS}>
        <SelectTrigger
          className="flex w-fit @4xl/main:hidden"
          size="sm"
          id="cancellation-status-selector"
        >
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

      {/* Ẩn/hiện đặt ở ROOT chứ không ở TabsList — root là con trực tiếp của
          hàng `justify-between` (cùng lý do đã ghi ở bookings-toolbar). */}
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
