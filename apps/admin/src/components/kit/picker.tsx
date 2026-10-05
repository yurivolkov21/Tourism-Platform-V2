'use client';

import { Label } from '@tourism/ui/components/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { cn } from '@tourism/ui/lib/utils';
import * as React from 'react';
import { MENU_HINT, MENU_LABEL, MENU_TOOLBAR_POPUP } from '@/components/kit/menu-style';
import { TOOLBAR_SELECT } from '@/components/kit/toolbar-metrics';

/**
 * Ô chọn chung của admin (spec 2026-10-05 §2.2) — thay `FormSelect` (form) và
 * `ToolbarSelect` (hàng điều khiển bảng).
 *
 * Vẫn là Base UI **Select** chứ không phải Menu: đây là ô của FORM — role
 * `combobox`/`listbox`, gõ chữ để nhảy, nhãn `FormField` nối qua `id`. Chỉ khoác dáng
 * của `ToolbarFilterMenu`: danh sách thả XUỐNG dưới ô (`alignItemWithTrigger={false}`,
 * thay cho kiểu đè lên ô của Select mặc định), nhãn nhóm, vạch ngăn, icon và chữ phụ mờ.
 *
 * Hai biến thể của ô:
 * - `field` — dáng ô nhập (viền `border-input`, 32px), thêm nền nhạt khi rê và khi mở;
 * - `toolbar` — dáng nút lọc (viền nút, 36px, chữ đậm vừa).
 *
 * Giá trị luôn là CHUỖI; `''` là chưa chọn và ô hiện `placeholder`.
 */
export interface PickerOption {
  value: string;
  label: string;
  /** Icon đầu mục; mục đang chọn có icon thì ô cũng hiện nó. */
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Chữ phụ mờ sau tên (vd "Hidden") — thay cho kiểu ghép "(hidden)" vào tên. */
  hint?: string;
}

export interface PickerGroup {
  /** Khoá React của nhóm — tên họ, không phải chỉ số mảng. */
  key: string;
  /** Nhãn nhóm; bỏ trống thì nhóm không có tiêu đề. */
  label?: string;
  options: readonly PickerOption[];
}

type PickerSource =
  | { options: readonly PickerOption[]; groups?: undefined }
  | { groups: readonly PickerGroup[]; options?: undefined };

export type PickerProps = PickerSource & {
  /** `id` của trigger — nhãn `FormField` (hoặc `label` bên dưới) trỏ vào nó. */
  id: string;
  /** Giá trị đang chọn; `''` = chưa chọn. */
  value: string;
  onValueChange: (value: string) => void;
  variant?: 'field' | 'toolbar';
  /** Nhãn sr-only cho ô KHÔNG nằm trong `FormField` (hàng điều khiển bảng). */
  label?: string;
  /** Câu hiện trên ô khi chưa chọn gì. */
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** `aria-describedby` do `FormField` cấp (gợi ý và/hoặc lỗi). */
  describedBy?: string;
  /** Hướng mở — `top` cho ô nằm sát đáy trang như Rows per page. */
  side?: 'top' | 'bottom';
  className?: string;
};

/** Ô dáng ô nhập: giữ viền và cao của `SelectTrigger`, thêm phản hồi khi rê và khi mở. */
const FIELD_TRIGGER = 'w-full hover:bg-muted/50 data-popup-open:bg-muted/50';

/**
 * Ô dáng nút lọc — chép biến thể `outline` của `Button` lên `SelectTrigger`. `cn` chạy
 * `twMerge` nên class ở đây thắng class mặc định của trigger (xem `toolbar-metrics.ts`).
 */
const TOOLBAR_TRIGGER = cn(
  TOOLBAR_SELECT,
  'w-fit border-border bg-background px-3 font-medium hover:bg-muted data-popup-open:bg-muted dark:border-input',
);

/** Popup của ô form: rộng ít nhất bằng ô, nở theo mục dài nhất, tối đa 22rem. */
const FIELD_POPUP = 'w-auto min-w-(--anchor-width) max-w-88';

function groupsOf(source: PickerSource): readonly PickerGroup[] {
  return source.groups !== undefined
    ? source.groups
    : [{ key: 'options', options: source.options }];
}

export function Picker(props: PickerProps) {
  const {
    id,
    value,
    onValueChange,
    variant = 'field',
    label,
    placeholder = '',
    disabled = false,
    invalid = false,
    describedBy,
    side = 'bottom',
    className,
  } = props;
  const groups = groupsOf(props);
  const all = groups.flatMap((group) => group.options);
  const current = all.find((option) => option.value === value);

  return (
    <>
      {label ? (
        <Label htmlFor={id} className="sr-only">
          {label}
        </Label>
      ) : null}
      <Select
        // Chuỗi rỗng đi thẳng xuống: Base UI 1.6 coi `''` là "chưa chọn" nên
        // `data-placeholder` tự gắn lên trigger (cùng nếp `FormSelect` cũ).
        value={value}
        items={all.map((option) => ({ value: option.value, label: option.label }))}
        disabled={disabled}
        onValueChange={(next) => {
          // Base UI phát `null` khi mục đang chọn bị gỡ khỏi danh sách giữa chừng —
          // đó không phải lựa chọn của người dùng.
          if (next !== null && next !== undefined) onValueChange(String(next));
        }}
      >
        <SelectTrigger
          id={id}
          className={cn(variant === 'toolbar' ? TOOLBAR_TRIGGER : FIELD_TRIGGER, className)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        >
          {/* Hàm render tự dựng nội dung ô để kèm icon và hint của mục đang chọn.
              Giá trị KHÔNG khớp mục nào (mục vừa bị gỡ, URL gõ tay) thì in thẳng giá trị,
              cùng luật "nút in chính value" của `ToolbarFilterMenu`: form vẫn giữ giá trị ấy,
              nên hiện câu giữ chỗ là nói dối rằng chưa chọn gì, còn ô toolbar (không có câu
              giữ chỗ) thì trơ mỗi mũi tên. Chỉ `''` mới là chưa chọn. */}
          <SelectValue>
            {() => (current ? <OptionContent option={current} /> : value || placeholder)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          side={side}
          align={variant === 'toolbar' ? 'end' : 'start'}
          className={variant === 'toolbar' ? MENU_TOOLBAR_POPUP : FIELD_POPUP}
        >
          {groups.map((group, index) => (
            <React.Fragment key={group.key}>
              {index > 0 ? <SelectSeparator /> : null}
              <SelectGroup>
                {group.label ? (
                  <SelectLabel className={MENU_LABEL}>{group.label}</SelectLabel>
                ) : null}
                {group.options.map((option) => (
                  <SelectItem key={option.value} value={option.value} label={option.label}>
                    <OptionContent option={option} />
                  </SelectItem>
                ))}
              </SelectGroup>
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/** Icon, tên và chữ phụ của một mục — dùng chung cho danh sách và ô. */
function OptionContent({ option }: { option: PickerOption }) {
  const Icon = option.icon;
  return (
    <>
      {Icon ? <Icon aria-hidden="true" /> : null}
      <span className="truncate">{option.label}</span>
      {option.hint ? (
        <>
          {/* Khoảng trắng THẬT giữa tên và hint: tên trợ năng đọc "Retired Hidden",
              không dính thành "RetiredHidden". Flex bỏ qua text node trắng nên mắt
              không thấy khác. */}{' '}
          <span className={MENU_HINT}>{option.hint}</span>
        </>
      ) : null}
    </>
  );
}
