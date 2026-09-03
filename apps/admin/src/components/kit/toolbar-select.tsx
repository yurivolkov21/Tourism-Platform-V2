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
import { cn } from '@tourism/ui/lib/utils';
import { TOOLBAR_SELECT } from '@/components/kit/toolbar-metrics';

/**
 * Select của hàng điều khiển bảng admin — nhãn ẩn cho trình đọc màn hình +
 * `Select` của @tourism/ui với số đo `TOOLBAR_SELECT` (kit P4c — nâng từ BA
 * bản chép byte-for-byte ở vòng vá review F7: nhánh mobile của
 * `StatusFilterTabs`, ô tháng của `/reports`, ô loại email của `/outbox`).
 *
 * Kit chỉ lo hình dạng; vùng lo giá trị và URL. `onSelect` nhận CHUỖI vì
 * Base UI Select trả `unknown` — vùng tự `safeParse` về enum của nó (nếp
 * bookings, review F1: giá trị lạ rơi êm về "All", không ném ZodError).
 *
 * `onValueChange` chặn `null`: Base UI phát null khi item bị gỡ giữa chừng
 * (đổi trang làm danh sách đổi) — đẩy "null" lên URL là một filter rác.
 */
export interface ToolbarSelectItem {
  label: string;
  value: string;
}

/**
 * Đóng/mở giá trị TỰ DO (chuỗi từ DB: `source` của subscribers, `type` của
 * payment events) để nó không bao giờ đụng sentinel "All" của kit (vòng vá
 * review F10: một hàng `source = 'ALL'` từng làm mục đó xoá filter và ô
 * hiện nhầm "All sources"). Tiền tố `v:` — mọi giá trị thật đều đi qua nó,
 * nên sentinel `ALL_FILTER_VALUE` là chuỗi duy nhất KHÔNG mang tiền tố.
 */
const FREE_VALUE_PREFIX = 'v:';

export function toFreeValue(value: string): string {
  return `${FREE_VALUE_PREFIX}${value}`;
}

/** Giá trị Select → chuỗi thật; `null` khi là mục "All" (không có tiền tố). */
export function fromFreeValue(selected: string): string | null {
  return selected.startsWith(FREE_VALUE_PREFIX) ? selected.slice(FREE_VALUE_PREFIX.length) : null;
}

export function ToolbarSelect({
  id,
  label,
  value,
  items,
  onSelect,
  className,
}: {
  /** `id` của trigger — mỗi ô một id, tránh trùng khi hai bảng cùng DOM. */
  id: string;
  /** Nhãn ẩn (sr-only) — hàng điều khiển đã chật. */
  label: string;
  value: string;
  items: ToolbarSelectItem[];
  onSelect: (value: string) => void;
  /** Bề rộng/ẩn-hiện theo vùng (`w-fit`, `w-48`, `@4xl/main:hidden`…). */
  className?: string;
}) {
  return (
    <>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null && next !== undefined) onSelect(String(next));
        }}
        items={items}
      >
        <SelectTrigger className={cn('w-fit', TOOLBAR_SELECT, className)} size="default" id={id}>
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
    </>
  );
}
