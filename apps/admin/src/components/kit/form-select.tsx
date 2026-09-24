'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { cn } from '@tourism/ui/lib/utils';

/**
 * Ô chọn của form admin — `Select` của @tourism/ui, cùng dáng dropdown với ô chọn
 * ở thanh công cụ (`ToolbarSelect`) và ở phân trang.
 *
 * Ra đời ở lượt thử tay F15 (24/09): ô vùng của form điểm đến từng là `<select>`
 * gốc mặc bộ class của `Input`, và danh sách xổ xuống là của TRÌNH DUYỆT — lệch
 * hẳn mọi dropdown khác của back office. User góp ý chữa về cùng một kiểu.
 *
 * Nằm trong `FormField` của kit như mọi ô khác: `id` nối với nhãn của FormField,
 * `describedBy` nối với câu gợi ý/câu lỗi. Giá trị là CHUỖI; chuỗi rỗng nghĩa là
 * chưa chọn gì và trigger hiện câu giữ chỗ.
 */
export interface FormSelectOption {
  value: string;
  label: string;
}

export function FormSelect({
  id,
  value,
  options,
  placeholder,
  onValueChange,
  disabled = false,
  invalid = false,
  describedBy,
  className,
}: {
  /** `id` của trigger — nhãn của `FormField` trỏ vào nó. */
  id: string;
  /** Giá trị đang chọn; `''` = chưa chọn. */
  value: string;
  options: readonly FormSelectOption[];
  /** Câu hiện trên trigger khi chưa chọn gì. */
  placeholder: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** `aria-describedby` do `FormField` cấp (gợi ý và/hoặc lỗi). */
  describedBy?: string;
  className?: string;
}) {
  return (
    <Select
      // Chuỗi rỗng đi thẳng xuống: Base UI 1.6 coi `''` là "chưa chọn" (đo ở
      // `SelectRoot.js`, cờ `hasSelectedValue`) nên câu giữ chỗ và
      // `data-placeholder` tự hiện — test "chưa chọn" canh đúng điều này.
      value={value}
      items={options}
      disabled={disabled}
      onValueChange={(next) => {
        // Base UI phát `null` khi mục đang chọn bị gỡ khỏi danh sách giữa chừng —
        // với form thì đó không phải lựa chọn của người dùng.
        if (next !== null && next !== undefined) onValueChange(String(next));
      }}
    >
      <SelectTrigger
        id={id}
        className={cn('w-full', className)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
