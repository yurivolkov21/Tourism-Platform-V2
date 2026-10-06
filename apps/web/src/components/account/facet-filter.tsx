'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@tourism/ui/components/popover';
import { Separator } from '@tourism/ui/components/separator';
import { cn } from '@tourism/ui/lib/utils';
import { CirclePlusIcon } from 'lucide-react';
import { useId, useState } from 'react';

/** Một lựa chọn: giá trị đi vào URL, nhãn khách đọc, số đơn (tổng tĩnh, ADR-0054 §2). */
export interface FacetFilterOption<V extends string> {
  value: V;
  label: string;
  count: number;
}

/**
 * Nút lọc chọn nhiều kiểu "faceted filter" của shadcn/ui (spec P7 §7.2) — dựng bằng
 * `Popover` + `Checkbox` có sẵn của `@tourism/ui`, không thêm gì vào kit. Chữ của nút và menu
 * là chữ của My bookings ("trips"), nên file nằm ở `components/account`.
 *
 * Nút (bản vẽ `booking-list.src.html` phần 1): viền gạch đứt, icon ⊕; chọn một giá trị thì
 * hiện vạch ngăn và nhãn giá trị, từ hai trở lên thì "{n} selected". Cỡ cố định do nơi dùng
 * truyền qua `className`. Menu đang mở thì chỉ đổi nền nhạt — `aria-expanded:bg-muted` của
 * biến thể `outline` lo, không thêm viền.
 *
 * "Clear filters" đóng menu: nút ấy biến mất ngay sau cú bấm, để menu mở là tiêu điểm rơi về
 * `<body>`; đóng menu thì Base UI trả tiêu điểm về nút lọc.
 */
export function FacetFilter<V extends string>({
  label,
  options,
  selected,
  onToggle,
  onClear,
  className,
}: {
  label: string;
  options: readonly FacetFilterOption<V>[];
  selected: readonly V[];
  onToggle: (value: V) => void;
  onClear: () => void;
  className?: string;
}) {
  const tb = messages.accountBookings;
  const idPrefix = useId();
  const [open, setOpen] = useState(false);
  const first = selected[0];
  const summary =
    first === undefined
      ? null
      : selected.length === 1
        ? (options.find((option) => option.value === first)?.label ?? first)
        : tb.selectedCount(selected.length);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={summary === null ? label : tb.filterButtonAria(label, summary)}
            className={cn(
              'h-9 justify-start gap-2 overflow-hidden border-dashed border-muted-foreground/60 px-3 text-[13px] font-semibold',
              className,
            )}
          >
            <CirclePlusIcon aria-hidden="true" />
            {label}
            {summary === null ? null : (
              <>
                <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
                <span className="min-w-0 truncate rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-semibold">
                  {summary}
                </span>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-60 gap-0 p-1">
        {options.map((option) => {
          // Id ghép từ `useId`: hai nút lọc trên cùng trang không bao giờ trùng id ô tích.
          const id = `${idPrefix}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted"
            >
              <Checkbox
                id={id}
                checked={selected.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
              />
              <span className="flex-1 truncate">{option.label}</span>
              <span className="sr-only">{tb.optionCount(option.count)}</span>
              <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
                {option.count}
              </span>
            </label>
          );
        })}
        {selected.length === 0 ? null : (
          <>
            <Separator className="my-1" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false);
                onClear();
              }}
            >
              {tb.clearFilters}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
