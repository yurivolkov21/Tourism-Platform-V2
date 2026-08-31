'use client';

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

/**
 * Bộ lọc trạng thái của bảng admin (kit P4b — nâng từ cặp bản chép
 * bookings-toolbar/cancellations-toolbar ở review F3 31/08): cặp "TabsList ở
 * màn rộng · Select ở màn hẹp" (`@4xl/main`) đúng khuôn block dashboard-01,
 * để mọi bảng vùng nhìn là một hệ (user chốt 31/08).
 *
 * Component chỉ làm MỘT việc: báo `onSelect(value)` — vùng tự quyết đổi URL
 * thế nào (safeParse enum, dựng href). Giá trị "tất cả" cũng do vùng đặt
 * (Select/Tabs cần một value thật, URL thì bỏ trống).
 */
/**
 * Giá trị tab "tất cả" — hợp đồng riêng với component này (Select/Tabs cần
 * một value thật, URL thì bỏ trống). Ở KIT chứ không ở từng toolbar: ba vùng
 * từng chép tay `'ALL'`, vùng thứ tư gõ `'all'` là filter chọn nhầm im lặng
 * (review F4 31/08). Chữ HOA để không đụng member enum contract nào.
 */
export const ALL_FILTER_VALUE = 'ALL';

export interface StatusFilterItem {
  label: string;
  value: string;
}

export function StatusFilterTabs({
  items,
  value,
  label,
  selectId,
  onSelect,
}: {
  items: StatusFilterItem[];
  value: string;
  /** Nhãn cho cả cụm (sr-only trên Select, aria-label trên Tabs). */
  label: string;
  /** `id` của SelectTrigger — mỗi bảng một id, tránh trùng khi hai bảng cùng DOM. */
  selectId: string;
  onSelect: (value: string) => void;
}) {
  return (
    <>
      <Label htmlFor={selectId} className="sr-only">
        {label}
      </Label>
      {/* Màn hẹp: select gọn — cùng cặp @4xl/main của block dashboard-01. */}
      <Select value={value} onValueChange={(next) => onSelect(String(next))} items={items}>
        <SelectTrigger className="flex w-fit @4xl/main:hidden" size="sm" id={selectId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
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
        onValueChange={(next) => onSelect(String(next))}
        aria-label={label}
        className="hidden @4xl/main:flex"
      >
        <TabsList>
          {items.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </>
  );
}
