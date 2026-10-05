# Đợt sửa sạn giao diện admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gom ba họ dropdown của admin về một `Picker`, biến Quick Create thành menu tạo nhanh,
cho xoá danh mục và điểm đến chưa tour nào dùng, và vá mười ba sạn nhỏ.

**Architecture:**

- **Dropdown:** `Picker` là Base UI Select (giữ role `combobox`) khoác dáng menu lọc. Hằng style
  dùng chung nằm ở `kit/menu-style.ts` cho cả `Picker` lẫn `ToolbarFilterMenu`.
- **Xoá (ADR-0053):** hai thủ tục `delete` mới đi theo khuôn `admin.tours.delete`.
  - Danh mục để khoá ngoại `Restrict` của DB làm phán quyết.
  - Điểm đến khoá hàng (`FOR UPDATE`) rồi đếm liên kết trong cùng transaction.
- **Quick Create:** gắn `?create=1` vào URL; trang nhận tham số thì mở sẵn hộp tạo, rồi gỡ tham số
  khỏi URL.

**Tech Stack:** Next 16 (admin), NestJS 11 + oRPC + Prisma 7 (API), Base UI 1.6, Vitest 4,
Tailwind 4, Biome.

**Spec:** [docs/specs/2026-10-05-admin-ui-polish-design.md](../specs/2026-10-05-admin-ui-polish-design.md)
· ADR: [docs/adr/0053-delete-unused-categories-destinations.md](../adr/0053-delete-unused-categories-destinations.md)

## Global Constraints

- Không migration, không đổi schema DB.
- Copy người dùng thấy: tiếng Anh, nằm ở `@tourism/i18n`. Comment code: tiếng Việt (CLAUDE.md luật 7–8).
- Tokens-only, không hex (luật 6).
- TDD: test trước, chạy thấy đỏ, code tối thiểu, chạy thấy xanh (luật 4).
- Commit: Conventional Commits, tiếng Việt có dấu, KHÔNG dòng attribution AI; `git add` đường dẫn
  cụ thể (luật 12).
- Không chạm hạ tầng sống trong lúc thi công: không deploy, không Supabase, không Render/Vercel
  (luật 15).
- Markdown: không để `+` ở đầu dòng; `git diff` mọi file `.md` trước khi stage.
- Hãm tài nguyên: test chạy `--maxWorkers=4`; build turbo `--concurrency=1`.
- `@tourism/i18n`, `@tourism/contract`, `@tourism/ui` được admin và API đọc từ `dist`, nên sửa lib
  nào thì build lại lib ấy trước khi chạy test của app:
  `pnpm turbo run build --filter=@tourism/i18n --filter=@tourism/contract --filter=@tourism/ui --concurrency=1`
- Cổng cuối: `pnpm gate:int` xanh (luật 11) — Task 19.

## Lệnh hay dùng

```bash
pnpm --filter @tourism/admin exec vitest run <file> --maxWorkers=4
pnpm --filter @tourism/contract exec vitest run <file>
pnpm --filter @tourism/ui exec vitest run <file>
pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts <file>
pnpm --filter @tourism/admin typecheck
```

Int test cần Docker Postgres (`docker ps`; tắt thì `docker start tourism-v2-postgres-1`).

## Quyết định của plan

Những chỗ spec để ngỏ, plan chốt như sau:

1. **Hint ở menu lọc `/tours` nữa.** `ToolbarFilterMenuItem` cũng nhận `hint`, nên danh mục đã ẩn
   ở menu lọc `/tours` đổi "(hidden)" thành nhãn mờ như `Picker` — hai họ dùng chung một bộ style,
   không thể một bên ghép chữ một bên mờ. Hàm `categoryHidden(name)` của i18n thay bằng chuỗi
   `hiddenHint` (= `CATALOG_VISIBILITY_COPY.hidden`, "Hidden").
2. **Hint và tên cách nhau một khoảng trắng thật** (`{' '}`), để tên trợ năng của option đọc
   "Retired Hidden", không phải "RetiredHidden". Flexbox bỏ qua text node chỉ có khoảng trắng nên
   mắt không thấy gì khác.
3. **`IN_USE` của lệnh xoá là mã "trạng thái cũ"** (`stale`): đóng hộp, toast lỗi, làm mới bảng.
   Sau khi làm mới thì nút Delete đã khoá kèm tooltip — đúng chỗ admin cần nhìn.
4. **Ngày chuyến tách khỏi khoảng lọc.** Thêm `formatTripDates(start, end)` (trùng ngày thì in
   một ngày) cho mọi chỗ in ngày chuyến. `formatDateRange` giữ nguyên cho câu "between …" của bộ
   lọc ngày, để câu ấy không thành "between 12 Oct 2026".
5. **Quick Create không đọc URL trong bảng.** Trang (server component) đọc `create=1` rồi truyền
   prop `openCreate`; bảng/hộp mở bằng một effect theo prop (cùng route đổi query thì component
   không remount, nên `useState` khởi đầu không đủ). Gỡ tham số khỏi URL là việc của component nhỏ
   `StripCreateParam`. Nhờ vậy các spec đang mock `next/navigation` chỉ có `useRouter` không vỡ.
6. **Hai component kit mới cho lệnh xoá**, vì hai bảng dùng y hệt nhau (luật kit ≥ 2 consumer):
   `TourCountCell` (ô Tours) và `DeleteRowAction` (nút Delete, tooltip và hộp xác nhận).
7. **Ô thumb dùng chung `SafeImg`** cho ảnh review, bảng Tours, bảng Posts. Ngoài `onError`, nó
   đo lại một lần sau mount (`complete && naturalWidth === 0`) để bắt ảnh hỏng trước khi hydrate.
8. **Bảng Tours đổi tên trường VM `heroUrl` → `thumbUrl`**, giống bảng Posts, vì giá trị giờ là
   URL đã thu về `w_160`.
9. **Lưới thẻ số liệu:** 2 cột từ màn hẹp nhất, trừ hàng chỉ có một thẻ (giữ 1 cột).
10. **Outbox:** Type `max-w-52`, Recipient `max-w-48`, Last error `max-w-40`; kiểm cuộn ngang ở
    1440px trong Task 19.

## Bản đồ file

| File | Việc |
| --- | --- |
| `apps/admin/src/components/kit/menu-style.ts` (mới) | Hằng style dùng chung của dropdown |
| `apps/admin/src/components/kit/picker.tsx` (mới) và spec | Ô chọn chung |
| `apps/admin/src/components/kit/toolbar-filter-menu.tsx` | Nhận `hint`, đọc hằng style |
| `apps/admin/src/components/kit/toolbar-date-range.tsx` | Màu mũi tên |
| `apps/admin/src/lib/catalog-option.ts` (mới) và spec | Option danh mục/điểm đến kèm hint |
| `apps/admin/src/components/kit/form-select.tsx`, `toolbar-select.tsx` và spec | Xoá |
| `libs/shared/ui/src/components/popover.tsx`, `tooltip.tsx` và spec mới | z-index token |
| `libs/shared/contract/src/schemas/admin-categories.ts`, `admin-destinations.ts`, `contract.ts` | Thủ tục `delete`, `linkedTourCount` |
| `apps/api/src/modules/catalog/admin-categories.*`, `admin-destinations.*` | Lệnh xoá và số tour |
| `apps/admin/src/components/kit/tour-count-cell.tsx`, `delete-row-action.tsx` (mới) | Kit cho lệnh xoá |
| `apps/admin/src/components/categories/*`, `destinations/*`, `lib/categories-*`, `lib/destinations-*`, `app/(admin)/categories/*`, `app/(admin)/destinations/*` | UI xoá |
| `apps/admin/src/components/quick-create-menu.tsx` (mới), `nav-main.tsx`, `lib/create-param.ts` (mới), `kit/strip-create-param.tsx` (mới) | Quick Create |
| `apps/admin/src/components/tours/editor/clamped-summary.tsx` (mới), `step-aside.tsx` | Báo Summary bị cắt |
| `apps/admin/src/components/reviews/reject-review-dialog.tsx` | Bố cục hộp Reject |
| `apps/admin/src/components/kit/safe-img.tsx` (mới), `kit/email-text.tsx` (mới) | Ảnh hỏng, email xuống dòng |
| Các file bảng/view còn lại của khối C | Sạn nhỏ |

---

### Task 1: Kit `Picker`, hằng style chung, hint và mũi tên của menu lọc

**Files:**

- Create: `apps/admin/src/components/kit/menu-style.ts`
- Create: `apps/admin/src/components/kit/picker.tsx`
- Create: `apps/admin/src/components/kit/picker.spec.tsx`
- Modify: `apps/admin/src/components/kit/toolbar-filter-menu.tsx`
- Modify: `apps/admin/src/components/kit/toolbar-filter-menu.spec.tsx`
- Modify: `apps/admin/src/components/kit/toolbar-date-range.tsx:190`

**Interfaces:**

- Produces:
  - `PickerOption { value: string; label: string; icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>; hint?: string }`
  - `PickerGroup { key: string; label?: string; options: readonly PickerOption[] }`
  - `Picker(props: PickerProps)` với `PickerProps` = (`{ options }` hoặc `{ groups }`) và
    `{ id: string; value: string; onValueChange(value: string): void; variant?: 'field' | 'toolbar'; label?: string; placeholder?: string; disabled?: boolean; invalid?: boolean; describedBy?: string; side?: 'top' | 'bottom'; className?: string }`
  - `MENU_HINT`, `MENU_LABEL`, `MENU_TOOLBAR_POPUP`, `MENU_CHEVRON` (chuỗi class)
  - `ToolbarFilterMenuItem.hint?: string`

- [ ] **Step 1: Viết spec của `Picker` (đỏ vì chưa có module)**

Tạo `apps/admin/src/components/kit/picker.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Picker, type PickerProps } from './picker';

/**
 * Ô chọn chung của admin (spec 2026-10-05 §2.2): vẫn là Select của form — role combobox, gõ
 * chữ để nhảy — nhưng danh sách thả XUỐNG như menu lọc, có nhãn nhóm, vạch ngăn, icon và nhãn
 * phụ mờ. Thay `FormSelect` và `ToolbarSelect`; các ca dưới gom từ spec của hai kit cũ.
 */
const OPTIONS = [
  { value: 'Northern Vietnam', label: 'Northern Vietnam' },
  { value: 'Central Vietnam', label: 'Central Vietnam' },
  { value: 'Southern Vietnam', label: 'Southern Vietnam' },
];

function StubIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg data-testid="option-icon" {...props} />;
}

function renderPicker(props: Partial<PickerProps> = {}) {
  const onValueChange = vi.fn();
  const merged = {
    id: 'region',
    value: '',
    options: OPTIONS,
    placeholder: 'Choose a region',
    onValueChange,
    ...props,
  } as PickerProps;
  render(
    <>
      <label htmlFor="region">Region</label>
      <Picker {...merged} />
    </>,
  );
  return { onValueChange, trigger: screen.getByRole('combobox', { name: 'Region' }) };
}

describe('Picker', () => {
  it('chưa chọn thì hiện câu giữ chỗ, nhãn của form gọi đúng tên ô', () => {
    const { trigger } = renderPicker();
    expect(trigger).toHaveTextContent('Choose a region');
    expect(trigger).toHaveAttribute('data-placeholder');
  });

  it('có giá trị thì hiện NHÃN của mục đang chọn, không hiện giá trị thô', () => {
    const { trigger } = renderPicker({
      value: 'southern',
      options: [
        { value: 'northern', label: 'Northern Vietnam' },
        { value: 'southern', label: 'Southern Vietnam' },
      ],
    });
    expect(trigger).toHaveTextContent('Southern Vietnam');
    expect(trigger).not.toHaveTextContent('southern');
  });

  it('mở ra đủ các mục theo thứ tự; chọn một mục thì trả CHUỖI giá trị', async () => {
    const user = userEvent.setup();
    const { onValueChange, trigger } = renderPicker();

    await user.click(trigger);
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(OPTIONS.map((o) => o.label));
    await user.click(screen.getByRole('option', { name: 'Central Vietnam' }));

    expect(onValueChange).toHaveBeenCalledWith('Central Vietnam');
  });

  it('danh sách thả xuống dưới ô, không đè lên ô như Select cũ', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker();

    await user.click(trigger);
    await screen.findAllByRole('option');

    expect(document.querySelector('[data-slot="select-content"]')).toHaveAttribute(
      'data-align-trigger',
      'false',
    );
  });

  it('mang trạng thái lỗi và câu mô tả của FormField; không lỗi thì không có aria-invalid', () => {
    const { trigger } = renderPicker({ invalid: true, describedBy: 'region-error' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'region-error');
  });

  it('không lỗi thì KHÔNG mang aria-invalid', () => {
    const { trigger } = renderPicker({ invalid: false });
    expect(trigger).not.toHaveAttribute('aria-invalid');
  });

  it('disabled thì bấm không mở được', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({ disabled: true });

    await user.click(trigger);

    expect(trigger).toHaveAttribute('data-disabled');
    await expect(screen.findByRole('option', {}, { timeout: 300 })).rejects.toThrow();
  });

  it('nhóm: nhãn nhóm đặt tên cho nhóm, vạch ngăn giữa hai nhóm', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({
      options: undefined,
      groups: [
        { key: 'tour', options: [{ value: 'tour', label: 'This tour’s destinations' }] },
        {
          key: 'all',
          label: 'Destinations',
          options: [
            { value: 'd1', label: 'Hội An' },
            { value: 'd2', label: 'Hà Nội' },
          ],
        },
      ],
    } as Partial<PickerProps>);

    await user.click(trigger);
    const group = await screen.findByRole('group', { name: 'Destinations' });

    expect(within(group).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Hội An',
      'Hà Nội',
    ]);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('hint: chữ mờ sau tên, có mặt cả trong danh sách lẫn trên ô', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({
      value: 'c4',
      options: [
        { value: 'c1', label: 'Day Tours' },
        { value: 'c4', label: 'Retired', hint: 'Hidden' },
      ],
    });

    expect(trigger).toHaveTextContent('Retired');
    expect(trigger).toHaveTextContent('Hidden');
    await user.click(trigger);
    expect(await screen.findByRole('option', { name: 'Retired Hidden' })).toBeInTheDocument();
  });

  it('icon: hiện ở mục trong danh sách và trên ô của mục đang chọn', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({
      value: 'NEW',
      options: [
        { value: 'NEW', label: 'New', icon: StubIcon },
        { value: 'WON', label: 'Won', icon: StubIcon },
      ],
    });

    expect(within(trigger).getByTestId('option-icon')).toBeInTheDocument();
    await user.click(trigger);
    const option = await screen.findByRole('option', { name: 'Won' });
    expect(within(option).getByTestId('option-icon')).toBeInTheDocument();
  });

  it('toolbar: nhãn sr-only, cao 36px như nút lọc, popup rộng như menu lọc', async () => {
    const user = userEvent.setup();
    render(
      <Picker
        id="status"
        variant="toolbar"
        label="Filter by status"
        value="ALL"
        options={[
          { value: 'ALL', label: 'All' },
          { value: 'NEW', label: 'New' },
        ]}
        onValueChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(trigger).toHaveClass('data-[size=default]:h-9');

    await user.click(trigger);
    await screen.findAllByRole('option');
    expect(document.querySelector('[data-slot="select-content"]')).toHaveClass('w-66');
  });
});
```

- [ ] **Step 2: Chạy, thấy đỏ**

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit/picker.spec.tsx --maxWorkers=4`
Expected: FAIL — `Failed to resolve import "./picker"`.

- [ ] **Step 3: Viết `menu-style.ts`**

```ts
/**
 * Bộ class dùng chung của MỌI dropdown trong admin — `Picker` (Select) và
 * `ToolbarFilterMenu` (Menu) cùng đọc, để hai họ không trôi khỏi nhau (spec
 * 2026-10-05 §2.2). Chỉ chứa thứ HAI họ cùng cần; class riêng của từng primitive
 * vẫn nằm trong `@tourism/ui`.
 */

/** Chữ phụ mờ sau tên mục (vd "Hidden") — đẩy về mép phải, không đậm theo mục. */
export const MENU_HINT = 'ml-auto pl-3 text-xs font-normal text-muted-foreground';

/** Nhãn nhóm: `DropdownMenuLabel` sẵn `font-medium`, `SelectLabel` thì chưa — thêm cho bằng. */
export const MENU_LABEL = 'font-medium';

/** Bề rộng popup của dropdown trên hàng điều khiển bảng (khuôn dm-10, 264px). */
export const MENU_TOOLBAR_POPUP = 'w-66';

/** Màu mũi tên của MỌI trigger dropdown — trước đợt này ba nơi ba màu. */
export const MENU_CHEVRON = 'text-muted-foreground';
```

- [ ] **Step 4: Viết `picker.tsx`**

```tsx
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
          {/* Hàm render tự dựng nội dung ô để kèm icon và hint của mục đang chọn. */}
          <SelectValue>
            {() => (current ? <OptionContent option={current} /> : placeholder)}
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
```

- [ ] **Step 5: Chạy, thấy xanh**

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit/picker.spec.tsx --maxWorkers=4`
Expected: PASS (11 test). Nếu ca "toolbar … cao 36px" đỏ vì class bị `twMerge` gộp, in
`trigger.className` ra và sửa `TOOLBAR_TRIGGER` cho giữ đúng `data-[size=default]:h-9`.

- [ ] **Step 6: Thêm test hint và màu mũi tên cho `ToolbarFilterMenu`**

Thêm vào cuối `describe('ToolbarFilterMenu', …)` trong `toolbar-filter-menu.spec.tsx`:

```tsx
  it('mục có hint: tên đọc ra kèm hint, nút cũng hiện hint của mục đang lọc', async () => {
    const user = userEvent.setup();
    render(
      <ToolbarFilterMenu
        {...PROPS}
        value="v:retired"
        groups={[
          {
            key: 'categories',
            items: [
              { value: 'v:day', label: 'Day Tours' },
              { value: 'v:retired', label: 'Retired', hint: 'Hidden' },
            ],
          },
        ]}
      />,
    );

    const button = screen.getByRole('button', { name: /Filter by type/ });
    expect(button).toHaveTextContent('Retired');
    expect(button).toHaveTextContent('Hidden');
    await user.click(button);
    expect(
      await screen.findByRole('menuitemradio', { name: 'Retired Hidden' }),
    ).toBeInTheDocument();
  });

  it('mũi tên của nút dùng màu muted chung của mọi dropdown', () => {
    render(<ToolbarFilterMenu {...PROPS} value={ALL_FILTER_VALUE} />);
    const chevron = screen
      .getByRole('button', { name: /Filter by type/ })
      .querySelector('svg[data-icon="inline-end"]');
    expect(chevron).toHaveClass('text-muted-foreground');
  });
```

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit/toolbar-filter-menu.spec.tsx --maxWorkers=4`
Expected: FAIL ở hai ca mới (chưa có `hint`, mũi tên chưa có class).

- [ ] **Step 7: Sửa `toolbar-filter-menu.tsx`**

1. Import `MENU_CHEVRON`, `MENU_HINT`, `MENU_TOOLBAR_POPUP` từ `@/components/kit/menu-style`.
2. Thêm vào `ToolbarFilterMenuItem`:

```ts
  /** Chữ phụ mờ sau tên (vd "Hidden" cho danh mục đã ẩn) — cùng luật với `Picker`. */
  hint?: string;
```

3. Trong nút, thay khối nội dung bằng:

```tsx
        {CurrentIcon ? <CurrentIcon data-icon="inline-start" /> : null}
        {shownLabel}
        {shown?.hint ? <span className={MENU_HINT}>{shown.hint}</span> : null}
        <ChevronDownIcon data-icon="inline-end" className={MENU_CHEVRON} />
```

4. Đổi `aria-label={`${label}: ${shownLabel}`}` thành
   `aria-label={`${label}: ${shownLabel}${shown?.hint ? ` (${shown.hint})` : ''}`}`.
5. `<DropdownMenuContent align="end" className="w-66">` → `className={MENU_TOOLBAR_POPUP}`.
6. Trong `FilterMenuItem`, sau `{item.label}` thêm:

```tsx
      {item.hint ? (
        <>
          {' '}
          <span className={MENU_HINT}>{item.hint}</span>
        </>
      ) : null}
```

- [ ] **Step 8: Mũi tên của `ToolbarDateRange`**

Trong `apps/admin/src/components/kit/toolbar-date-range.tsx`, import `MENU_CHEVRON` và đổi
`<ChevronDownIcon data-icon="inline-end" aria-hidden="true" className="opacity-50" />` thành
`<ChevronDownIcon data-icon="inline-end" aria-hidden="true" className={MENU_CHEVRON} />`.

- [ ] **Step 9: Chạy lại cả kit, thấy xanh**

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit --maxWorkers=4`
Expected: PASS toàn bộ.

- [ ] **Step 10: Commit**

```bash
git add apps/admin/src/components/kit/menu-style.ts apps/admin/src/components/kit/picker.tsx apps/admin/src/components/kit/picker.spec.tsx apps/admin/src/components/kit/toolbar-filter-menu.tsx apps/admin/src/components/kit/toolbar-filter-menu.spec.tsx apps/admin/src/components/kit/toolbar-date-range.tsx
git commit -m "feat(admin): thêm ô chọn chung Picker khoác dáng menu lọc"
```

---

### Task 2: Mười ô chọn trong form chuyển sang `Picker`; "(hidden)" thành nhãn mờ

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (`admin.tours.list.categoryHidden`, `admin.photoLibrary`)
- Create: `apps/admin/src/lib/catalog-option.ts`, `apps/admin/src/lib/catalog-option.spec.ts`
- Modify: `apps/admin/src/lib/tour-editor-view.ts` (xoá `optionLabel`) và spec
- Modify: `apps/admin/src/lib/tours-view.ts` (xoá `categoryOptionLabel`) và spec
- Modify: `apps/admin/src/lib/api/tours.ts:50` (comment)
- Modify: `apps/admin/src/components/tours/tours-toolbar.tsx:96`
- Modify: `apps/admin/src/components/tours/editor/new-tour-dialog.tsx`, `tour-details-form.tsx`, `tour-costs-form.tsx`, `tour-content-form.tsx`
- Modify: `apps/admin/src/components/destinations/destination-form-dialog.tsx`
- Modify: `apps/admin/src/components/kit/photo-library-dialog.tsx`
- Modify specs: `new-tour-dialog.spec.tsx:179-184`, `tour-details-form.spec.tsx:338-344`, `tours-table.spec.tsx:149-162`
- Delete: `apps/admin/src/components/kit/form-select.tsx`, `form-select.spec.tsx`

**Interfaces:**

- Consumes: `Picker`, `PickerOption` (Task 1); `ToolbarFilterMenuItem.hint` (Task 1)
- Produces:
  - `hiddenHint(option: { isActive: boolean }): string | undefined`
  - `catalogOption(option: { id: string; name: string; isActive: boolean }): { value: string; label: string; hint?: string }`
  - i18n `messages.admin.tours.list.hiddenHint: string` ("Hidden"),
    `messages.admin.photoLibrary.destinationsGroup: string` ("Destinations")

- [ ] **Step 1: i18n**

Trong `messages.ts`, khối `admin.tours.list`, thay cả khối JSDoc và dòng
`categoryHidden: (name: string) => `${name} (hidden)`,` bằng:

```ts
        /**
         * Nhãn phụ MỜ của danh mục/điểm đến đã ẩn trong mọi ô chọn và menu lọc (spec
         * 2026-10-05 §2.2) — thay kiểu ghép "(hidden)" vào tên. Menu vẫn có đủ hàng ẩn để
         * admin lọc ra tour thuộc chúng mà sửa (vòng review F14).
         */
        hiddenHint: CATALOG_VISIBILITY_COPY.hidden,
```

Trong khối `admin.photoLibrary`, sau `thisTour: …,` thêm `destinationsGroup: 'Destinations',`.

Run: `pnpm turbo run build --filter=@tourism/i18n --concurrency=1`
Expected: build xanh.

- [ ] **Step 2: Spec của `catalog-option` (đỏ)**

Tạo `apps/admin/src/lib/catalog-option.spec.ts`:

```ts
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { catalogOption, hiddenHint } from './catalog-option';

/**
 * Option danh mục/điểm đến cho `Picker` và menu lọc (spec 2026-10-05 §2.2): mục đã ẩn
 * giữ NGUYÊN tên và mang nhãn phụ mờ, thay kiểu ghép "(hidden)" vào tên (lượt thử tay F14:
 * admin phải thấy vì sao một nhóm tour đang bán không có chip nào trên web).
 */
const HIDDEN = messages.admin.tours.list.hiddenHint;

describe('hiddenHint', () => {
  it('mục đang hiện: không có nhãn phụ', () => {
    expect(hiddenHint({ isActive: true })).toBeUndefined();
  });

  it('mục đã ẩn: nhãn phụ "Hidden"', () => {
    expect(hiddenHint({ isActive: false })).toBe(HIDDEN);
    expect(HIDDEN).toBe('Hidden');
  });
});

describe('catalogOption', () => {
  it('đổi một hàng danh mục/điểm đến thành option của Picker', () => {
    expect(catalogOption({ id: 'c1', name: 'Day Tours', isActive: true })).toEqual({
      value: 'c1',
      label: 'Day Tours',
    });
    expect(catalogOption({ id: 'c4', name: 'Retired', isActive: false })).toEqual({
      value: 'c4',
      label: 'Retired',
      hint: HIDDEN,
    });
  });
});
```

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/catalog-option.spec.ts --maxWorkers=4`
Expected: FAIL — không resolve được `./catalog-option`.

- [ ] **Step 3: Viết `catalog-option.ts`**

```ts
import { messages } from '@tourism/i18n';

/**
 * Option danh mục/điểm đến dùng chung cho ô chọn ở khu sửa tour và menu lọc `/tours`
 * (spec 2026-10-05 §2.2). Thay `optionLabel` (tour-editor-view) và `categoryOptionLabel`
 * (tours-view): hai hàm ấy ghép "(hidden)" vào tên.
 */

/** Nhãn phụ của mục đã ẩn; mục đang hiện thì không có. */
export function hiddenHint(option: { isActive: boolean }): string | undefined {
  return option.isActive ? undefined : messages.admin.tours.list.hiddenHint;
}

/** Hàng danh mục/điểm đến → option của `Picker` (tên giữ nguyên, hint tách riêng). */
export function catalogOption(option: { id: string; name: string; isActive: boolean }): {
  value: string;
  label: string;
  hint?: string;
} {
  const hint = hiddenHint(option);
  return hint === undefined
    ? { value: option.id, label: option.name }
    : { value: option.id, label: option.name, hint };
}
```

Run lại lệnh Step 2. Expected: PASS.

- [ ] **Step 4: Gỡ hai hàm cũ**

- `lib/tour-editor-view.ts`: xoá hàm `optionLabel` và JSDoc của nó; xoá khối
  `describe('optionLabel', …)` cùng import `optionLabel` trong `tour-editor-view.spec.ts`.
- `lib/tours-view.ts`: xoá hàm `categoryOptionLabel` và JSDoc; xoá khối
  `describe('categoryOptionLabel', …)` cùng import trong `tours-view.spec.ts`.
- `lib/api/tours.ts:50`: đổi comment thành
  `/** Danh mục đã ẩn vẫn có trong menu, kèm nhãn phụ mờ — xem `hiddenHint` (lib/catalog-option). */`.
- `components/tours/tours-toolbar.tsx`: đổi import thành
  `import { hiddenHint } from '@/lib/catalog-option';` và mục menu thành:

```tsx
            items: categories.map((category) => ({
              label: category.name,
              hint: hiddenHint(category),
              value: toFreeValue(category.id),
              icon: TagIcon,
            })),
```

- [ ] **Step 5: Sửa spec cũ theo nhãn mới (đỏ trước khi đổi component)**

`new-tour-dialog.spec.tsx` (ca ở dòng 179):

```tsx
  it('danh mục đã ẩn vẫn chọn được, kèm nhãn phụ "Hidden"', async () => {
    const { user } = await openDialog();

    await user.click(screen.getByRole('combobox', { name: d.category }));
    expect(
      await screen.findByRole('option', {
        name: `Retired ${messages.admin.tours.list.hiddenHint}`,
      }),
    ).toBeInTheDocument();
  });
```

`tour-details-form.spec.tsx` (ca ở dòng 338):

```tsx
  it('danh mục ĐANG ẨN của tour được chọn sẵn, ô hiện tên kèm nhãn phụ "Hidden"', () => {
    renderForm(detailFixture({ categoryId: HIDDEN_CATEGORY_ID }));

    const trigger = screen.getByRole('combobox', { name: t.category });
    expect(trigger).toHaveTextContent('Retired');
    expect(trigger).toHaveTextContent(messages.admin.tours.list.hiddenHint);
  });
```

`tours-table.spec.tsx` (ca ở dòng 149): đổi tên ca thành
`'danh mục đã ẩn có mặt trong menu, KÈM nhãn phụ "Hidden"'` và dòng kiểm cuối thành:

```tsx
    expect(
      screen.getByRole('menuitemradio', { name: `Trekking & Adventure ${t.hiddenHint}` }),
    ).toBeInTheDocument();
```

Nếu file spec nào chưa import `messages`, thêm `import { messages } from '@tourism/i18n';`.

- [ ] **Step 6: Đổi các ô trong form sang `Picker`**

Mỗi file đổi `import { FormSelect } from '@/components/kit/form-select';` thành
`import { Picker } from '@/components/kit/picker';`, và đổi `<FormSelect` thành `<Picker` — props
giữ nguyên (`id`, `value`, `options`, `placeholder`, `disabled`, `invalid`, `describedBy`,
`onValueChange`). Thêm các thay đổi sau:

- `new-tour-dialog.tsx`:
  - đổi `import { optionLabel, tourStepHref } from '@/lib/tour-editor-view';` thành
    `import { tourStepHref } from '@/lib/tour-editor-view';`;
  - thêm `import { catalogOption } from '@/lib/catalog-option';`;
  - hai chỗ `options={options.categories.map((option) => ({ value: option.id, label: optionLabel(option) }))}`
    thành `options={options.categories.map(catalogOption)}` — chỗ còn lại là
    `options.destinations.map(catalogOption)`.
- `tour-details-form.tsx`:
  - bỏ `optionLabel` khỏi import `@/lib/tour-editor-view`;
  - thêm `import { catalogOption } from '@/lib/catalog-option';`;
  - `const categoryOptions = options.categories.map(catalogOption);`;
  - `const destinationOptions = options.destinations.map(catalogOption);`.
- `tour-costs-form.tsx`, `tour-content-form.tsx`, `destination-form-dialog.tsx`: chỉ đổi import
  và tên component.
- `photo-library-dialog.tsx`: thay khối `const options = [...]` bằng:

```tsx
  // Hai nhóm (spec 2026-10-05 §2.3): "This tour" đứng riêng trên vạch ngăn, các địa danh
  // nằm dưới một nhãn nhóm — trước đây hai loại xếp lẫn trong một danh sách phẳng.
  const groups = [
    ...(hasTourPhotos
      ? [{ key: 'tour', options: [{ value: THIS_TOUR, label: t.thisTour }] }]
      : []),
    {
      key: 'destinations',
      label: t.destinationsGroup,
      options: (library ?? []).map((group) => ({
        value: group.destination.id,
        label: group.destination.name,
      })),
    },
  ];
```

  rồi ô chọn:

```tsx
                <Picker
                  id="photo-library-destination"
                  value={shownFilter}
                  groups={groups}
                  placeholder={t.destination}
                  describedBy={describedBy}
                  onValueChange={setFilter}
                />
```

- [ ] **Step 7: Xoá `FormSelect`**

```bash
git rm apps/admin/src/components/kit/form-select.tsx apps/admin/src/components/kit/form-select.spec.tsx
```

Run: `grep -rn "form-select\|FormSelect" apps/admin/src`
Expected: không còn dòng nào.

- [ ] **Step 8: Chạy spec liên quan, thấy xanh**

Run: `pnpm --filter @tourism/admin exec vitest run src/components/tours src/components/destinations src/components/kit src/lib --maxWorkers=4`
Expected: PASS. Spec nào tìm option theo tên mà tên ấy có "(hidden)" thì sửa theo mẫu Step 5.

Run: `pnpm --filter @tourism/admin typecheck`
Expected: không lỗi.

- [ ] **Step 9: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts apps/admin/src/lib/catalog-option.ts apps/admin/src/lib/catalog-option.spec.ts apps/admin/src/lib/tour-editor-view.ts apps/admin/src/lib/tour-editor-view.spec.ts apps/admin/src/lib/tours-view.ts apps/admin/src/lib/tours-view.spec.ts apps/admin/src/lib/api/tours.ts apps/admin/src/components/tours apps/admin/src/components/destinations/destination-form-dialog.tsx apps/admin/src/components/kit/photo-library-dialog.tsx
git commit -m "feat(admin): đổi mười ô chọn trong form sang Picker, mục ẩn mang nhãn phụ mờ"
```

---

### Task 3: Ô chọn ở hàng điều khiển và phân trang chuyển sang `Picker`

**Files:**

- Modify: `apps/admin/src/components/kit/status-filter-tabs.tsx:78`
- Modify: `apps/admin/src/components/kit/status-filter-tabs.spec.tsx`
- Modify: `apps/admin/src/components/enquiries/enquiries-toolbar.tsx` (export icon)
- Modify: `apps/admin/src/components/enquiries/status-panel.tsx:43,81`
- Modify: `apps/admin/src/components/kit/table-pagination.tsx:114-136`
- Delete: `apps/admin/src/components/kit/toolbar-select.tsx`, `toolbar-select.spec.tsx`

**Interfaces:**

- Consumes: `Picker` (Task 1)
- Produces: `ENQUIRY_STATUS_ICONS: Record<EnquiryStatus, LucideIcon>` export từ `enquiries-toolbar.tsx`

- [ ] **Step 1: Test icon ở nhánh màn hẹp (đỏ)**

Thêm vào `status-filter-tabs.spec.tsx`:

```tsx
  it('nhánh màn hẹp (Picker) giữ icon của mục như dải tab màn rộng', async () => {
    const user = userEvent.setup();
    function StubIcon(props: React.SVGProps<SVGSVGElement>) {
      return <svg data-testid="status-icon" {...props} />;
    }
    render(
      <StatusFilterTabs
        items={[
          { label: 'All', value: 'ALL', icon: StubIcon },
          { label: 'Paid', value: 'PAID', icon: StubIcon },
        ]}
        value="ALL"
        label="Filter by status"
        selectId="status-mobile"
        onSelect={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(within(trigger).getByTestId('status-icon')).toBeInTheDocument();
    await user.click(trigger);
    const option = await screen.findByRole('option', { name: 'Paid' });
    expect(within(option).getByTestId('status-icon')).toBeInTheDocument();
  });
```

Thêm vào đầu file các import còn thiếu (`within`, `userEvent`, `vi`, `type * as React`).

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit/status-filter-tabs.spec.tsx --maxWorkers=4`
Expected: FAIL — `ToolbarSelect` không vẽ icon.

- [ ] **Step 2: `StatusFilterTabs` dùng `Picker`**

Đổi import `ToolbarSelect` thành `import { Picker } from '@/components/kit/picker';` và thay
khối `<ToolbarSelect … />` bằng:

```tsx
      <Picker
        id={selectId}
        variant="toolbar"
        label={label}
        value={value}
        options={items}
        onValueChange={onSelect}
        className="flex @4xl/main:hidden"
      />
```

Sửa comment phía trên khối cho đúng ("chính kit `Picker`, giữ icon như dải tab").

Run lại lệnh Step 1. Expected: PASS.

- [ ] **Step 3: Ô trạng thái enquiry có icon, cao 32px**

`enquiries-toolbar.tsx`: đổi `const STATUS_ICONS` thành
`export const ENQUIRY_STATUS_ICONS`, cập nhật hai chỗ dùng nó trong file (`STATUS_ICONS[status]`
→ `ENQUIRY_STATUS_ICONS[status]`).

`status-panel.tsx`:

```tsx
import { Picker } from '@/components/kit/picker';
import { ENQUIRY_STATUS_ICONS } from '@/components/enquiries/enquiries-toolbar';

const STATUS_ITEMS = EnquiryStatusSchema.options.map((status) => ({
  label: enquiryStatusLabel(status),
  value: status,
  icon: ENQUIRY_STATUS_ICONS[status],
}));
```

và thay `<ToolbarSelect … />` bằng:

```tsx
      <Picker
        id={`enquiry-status-${id}`}
        label={t.label}
        value={target}
        options={STATUS_ITEMS}
        onValueChange={select}
        // Cao 32px của biến thể field, bằng nút "Change status" đứng cạnh.
        className="w-fit"
      />
```

Run: `pnpm --filter @tourism/admin exec vitest run src/components/enquiries --maxWorkers=4`
Expected: PASS (tên option không đổi nên spec cũ giữ nguyên).

- [ ] **Step 4: Rows per page**

`table-pagination.tsx`: bỏ import các thành phần Select, thêm `import { Picker } from '@/components/kit/picker';`,
thay khối `<Select …>…</Select>` (dòng 114–136) bằng:

```tsx
          <Picker
            id="rows-per-page"
            value={`${pageSize}`}
            options={pageSizeOptions.map((size) => ({ value: `${size}`, label: `${size}` }))}
            // Ô nằm sát đáy trang — mở lên trên cho danh sách khỏi bị cắt.
            side="top"
            className="w-20"
            onValueChange={(value) => {
              // Chỉ điều hướng với số hợp lệ — `Number('')` = 0 sẽ treo `?limit=0` lên URL.
              const size = Number(value);
              if (Number.isInteger(size) && size > 0) router.push(hrefForPageSize(size));
            }}
          />
```

`Label htmlFor="rows-per-page"` giữ nguyên.

- [ ] **Step 5: Xoá `ToolbarSelect`**

```bash
git rm apps/admin/src/components/kit/toolbar-select.tsx apps/admin/src/components/kit/toolbar-select.spec.tsx
```

Run: `grep -rn "toolbar-select\|ToolbarSelect" apps/admin/src`
Expected: không còn dòng nào (`fromFreeValue`/`toFreeValue` đã import thẳng từ `kit/filter-value`).

- [ ] **Step 6: Chạy toàn bộ test admin và typecheck**

Run: `pnpm --filter @tourism/admin exec vitest run --maxWorkers=4`
Expected: PASS.
Run: `pnpm --filter @tourism/admin typecheck`
Expected: không lỗi.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/components/kit/status-filter-tabs.tsx apps/admin/src/components/kit/status-filter-tabs.spec.tsx apps/admin/src/components/enquiries/enquiries-toolbar.tsx apps/admin/src/components/enquiries/status-panel.tsx apps/admin/src/components/kit/table-pagination.tsx
git commit -m "feat(admin): ô lọc màn hẹp, trạng thái enquiry và Rows per page dùng Picker"
```

---

### Task 4: Popover và Tooltip dùng thang z-index token

**Files:**

- Modify: `libs/shared/ui/src/components/popover.tsx:31,36`
- Modify: `libs/shared/ui/src/components/tooltip.tsx:36,41`
- Create: `libs/shared/ui/src/components/popover.spec.ts`, `libs/shared/ui/src/components/tooltip.spec.ts`

- [ ] **Step 1: Spec (đỏ)**

`popover.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Đọc source như `dropdown-menu.spec.ts` — vitest của package chạy env `node`, và z-index
 * không quan sát được qua render. `z-50` thấp hơn hộp thoại (`--z-modal` 1400) và navbar web
 * (`--z-sticky` 1100): popover đặt trong hộp thoại sẽ chìm (spec 2026-10-05 §2.4).
 */
function code(): string {
  return readFileSync(fileURLToPath(new URL('./popover.tsx', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('Popover — hợp đồng xếp lớp', () => {
  it('Positioner và Popup dùng thang z token, không còn `z-50`', () => {
    const c = code();
    expect(c).not.toMatch(/(^|[\s'"])z-50([\s'"]|$)/);
    expect(c.match(/z-\(--z-popover\)/g) ?? []).toHaveLength(2);
  });
});
```

`tooltip.spec.ts`: giống hệt, đổi `./popover.tsx` → `./tooltip.tsx`, tên `describe` →
`'Tooltip — hợp đồng xếp lớp'`, và thay hai `expect` bằng:

```ts
    const c = code();
    // Mũi tên (`TooltipPrimitive.Arrow`) giữ `z-50` — nó nằm TRONG popup, xếp lớp cục bộ.
    expect(c.match(/z-\(--z-popover\)/g) ?? []).toHaveLength(2);
    expect(c).toMatch(/className="isolate z-\(--z-popover\)"/);
```

Run: `pnpm --filter @tourism/ui exec vitest run src/components/popover.spec.ts src/components/tooltip.spec.ts`
Expected: FAIL (đếm ra 0).

- [ ] **Step 2: Sửa hai file**

- `popover.tsx`: `className="isolate z-50"` → `className="isolate z-(--z-popover)"`; trong chuỗi
  class của Popup, `'z-50 flex w-72 …` → `'z-(--z-popover) flex w-72 …`.
- `tooltip.tsx`: `className="isolate z-50"` → `className="isolate z-(--z-popover)"`; chuỗi class
  của Popup `'z-50 inline-flex …` → `'z-(--z-popover) inline-flex …`. Không đụng `Arrow`.

Thêm một comment tiếng Việt phía trên Positioner của mỗi file, cùng nếp `select.tsx`:
`// z-index theo thang token, không phải z-50 của shadcn — xem spec 2026-10-05 §2.4.`

Run lại lệnh Step 1. Expected: PASS.

- [ ] **Step 3: Build lại `@tourism/ui`, chạy test ui**

Run: `pnpm turbo run build --filter=@tourism/ui --concurrency=1 && pnpm --filter @tourism/ui exec vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/shared/ui/src/components/popover.tsx libs/shared/ui/src/components/tooltip.tsx libs/shared/ui/src/components/popover.spec.ts libs/shared/ui/src/components/tooltip.spec.ts
git commit -m "fix(ui): popover và tooltip dùng thang z-index token như select và menu"
```

---

### Task 5: Contract — thủ tục `delete` và `linkedTourCount`

**Files:**

- Modify: `libs/shared/contract/src/schemas/admin-categories.ts`
- Modify: `libs/shared/contract/src/schemas/admin-destinations.ts`
- Modify: `libs/shared/contract/src/contract.ts` (import và hai khối `categories`, `destinations`)
- Modify: `libs/shared/contract/src/schemas/admin-categories.spec.ts`, `admin-destinations.spec.ts`

**Interfaces:**

- Produces:
  - `AdminCategoryDeleteInputSchema` / `AdminCategoryDeleteInput` (`{ id: string }`)
  - `AdminCategoryDeleteResultSchema` / `AdminCategoryDeleteResult` (`{ slug: string }`)
  - `AdminDestinationDeleteInputSchema` / `AdminDestinationDeleteInput`,
    `AdminDestinationDeleteResultSchema` / `AdminDestinationDeleteResult`
  - `AdminCategoryRow.linkedTourCount: number`, `AdminDestinationRow.linkedTourCount: number`
  - `contract.admin.categories.delete`, `contract.admin.destinations.delete`, mã `IN_USE` 409 và
    `NOT_FOUND` 404

- [ ] **Step 1: Test contract (đỏ)**

`admin-categories.spec.ts`:

- `ROW` thêm `linkedTourCount: 9,`.
- Thêm import `AdminCategoryDeleteInputSchema`, `AdminCategoryDeleteResultSchema`.
- Thêm ca:

```ts
describe('AdminCategoryDeleteInputSchema (ADR-0053)', () => {
  it('chỉ nhận id dạng uuid', () => {
    expect(AdminCategoryDeleteInputSchema.safeParse({ id: ID }).success).toBe(true);
    expect(AdminCategoryDeleteInputSchema.safeParse({ id: 'day-trips' }).success).toBe(false);
  });

  it('kết quả trả slug của hàng vừa xoá', () => {
    expect(AdminCategoryDeleteResultSchema.parse({ slug: 'day-trips' })).toEqual({
      slug: 'day-trips',
    });
  });
});

describe('AdminCategoryRowSchema — linkedTourCount', () => {
  it('đếm tour mọi trạng thái, không âm', () => {
    expect(AdminCategoryRowSchema.safeParse({ ...ROW, linkedTourCount: -1 }).success).toBe(false);
  });
});
```

- Trong `describe('contract admin.categories')`:
  - đổi tên ca đầu thành `'sáu thao tác mounted đúng đường'` và thêm vào mảng
    `[contract.admin.categories.delete, 'POST /api/admin/categories/{id}/delete'],`;
  - ca "mọi lệnh ghi theo id đều khai NOT_FOUND" thêm `contract.admin.categories.delete` vào mảng;
  - thêm ca:

```ts
  it('`delete` khai IN_USE 409 và NOT_FOUND 404 — không gì khác', () => {
    const errorMap = contract.admin.categories.delete['~orpc'].errorMap as Record<
      string,
      { status?: number }
    >;
    expect(Object.keys(errorMap).sort()).toEqual(['IN_USE', 'NOT_FOUND']);
    expect(errorMap.IN_USE?.status).toBe(409);
  });
```

`admin-destinations.spec.ts`:

- `ROW` thêm `linkedTourCount: 6,`; import hai schema delete của điểm đến; thêm hai ca tương tự
  khối categories ở trên (đổi tên `Category` → `Destination`, id `ID` của file này, slug `'hoi-an'`).
- Đổi ca `'bốn thao tác mounted đúng đường'` → `'năm thao tác mounted đúng đường'` và thêm
  `[contract.admin.destinations.delete, 'POST /api/admin/destinations/{id}/delete'],`.
- Thay ca `'KHÔNG có lệnh xoá, KHÔNG có lệnh sắp thứ tự'` bằng:

```ts
  it('có lệnh xoá (ADR-0053), KHÔNG có lệnh sắp thứ tự', () => {
    // Sắp: bảng này không có cột `order`. Xoá: chỉ khi chưa tour nào dùng, kiểm dưới
    // khoá hàng vì khoá ngoại `tour_destinations` khai `ON DELETE CASCADE`.
    expect(Object.keys(contract.admin.destinations).sort()).toEqual([
      'create',
      'delete',
      'list',
      'setActive',
      'update',
    ]);
  });
```

- Ca "mọi lệnh ghi theo id đều khai NOT_FOUND 404" thêm `contract.admin.destinations.delete`.
- Ca "tập mã của mỗi procedure" thêm
  `expect(codes(contract.admin.destinations.delete)).toEqual(['IN_USE', 'NOT_FOUND']);`.

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/admin-categories.spec.ts src/schemas/admin-destinations.spec.ts`
Expected: FAIL — export không tồn tại.

- [ ] **Step 2: Schema**

`admin-categories.ts`:

- Trong JSDoc đầu file, thay gạch đầu dòng `**Không có lệnh xoá.** …` bằng:

```ts
 * - **Xoá chỉ khi chưa tour nào dùng** (ADR-0053, thay quyết định "chỉ bật/tắt" của spec
 *   P4e-2 §2a). Khoá ngoại `tours.category_id` khai `RESTRICT`, nên DB tự chặn câu xoá
 *   khi còn tour; ẩn (`setActive`) vẫn là đường đảo ngược được cho hàng đang có tour.
```

- `AdminCategoryRowSchema` thêm sau `tourCount`:

```ts
  /** Số tour MỌI trạng thái thuộc danh mục — bằng 0 thì xoá được (ADR-0053 §5). */
  linkedTourCount: z.int().nonnegative(),
```

- Cuối file:

```ts
/** Xoá một danh mục chưa tour nào dùng (ADR-0053). */
export const AdminCategoryDeleteInputSchema = z.object({ id: z.uuid() });
export type AdminCategoryDeleteInput = z.output<typeof AdminCategoryDeleteInputSchema>;

/** Slug của hàng vừa xoá — cùng khuôn kết quả `admin.tours.delete`. */
export const AdminCategoryDeleteResultSchema = z.object({ slug: z.string() });
export type AdminCategoryDeleteResult = z.output<typeof AdminCategoryDeleteResultSchema>;
```

`admin-destinations.ts`: tương tự —

- JSDoc đầu file thay gạch `**Không có lệnh xoá.** …` bằng:

```ts
 * - **Xoá chỉ khi chưa tour nào dùng** (ADR-0053). Khoá ngoại `tour_destinations` khai
 *   `ON DELETE CASCADE` nên DB KHÔNG chặn — server kiểm số liên kết dưới khoá hàng trong
 *   cùng transaction rồi mới xoá.
```

- `AdminDestinationRowSchema` thêm
  `/** Số tour MỌI trạng thái gắn điểm đến — bằng 0 thì xoá được (ADR-0053 §5). */ linkedTourCount: z.int().nonnegative(),`
- Cuối file thêm `AdminDestinationDeleteInputSchema`, `AdminDestinationDeleteInput`,
  `AdminDestinationDeleteResultSchema`, `AdminDestinationDeleteResult` cùng khuôn ở trên.

- [ ] **Step 3: Contract**

`contract.ts`:

- Thêm `AdminCategoryDeleteInputSchema`, `AdminCategoryDeleteResultSchema` vào import từ
  `./schemas/admin-categories.js`; `AdminDestinationDeleteInputSchema`,
  `AdminDestinationDeleteResultSchema` vào import từ `./schemas/admin-destinations.js`.
- JSDoc khối `categories`: dòng đầu đổi thành
  `Danh mục tour phía admin (spec P4e-2 F14) — sáu thao tác, xoá chỉ khi chưa tour nào dùng (ADR-0053).`;
  thay đoạn "`is_active` đã có sẵn ở DB … Xoá thì không — nên không có." bằng:
  "Tắt một danh mục là nó biến khỏi chip lọc `/tours` mà mọi tour thuộc nó vẫn hiện nguyên.
  Xoá chỉ được khi không còn tour nào (mọi trạng thái): khoá ngoại `RESTRICT` làm phán quyết."
- Trong `categories`, sau `move`:

```ts
      delete: oc
        .route({
          method: 'POST',
          path: '/api/admin/categories/{id}/delete',
          summary: 'Delete a category that no tour uses',
        })
        .input(AdminCategoryDeleteInputSchema)
        .errors({
          IN_USE: { status: 409, message: 'This category is still used by tours' },
          NOT_FOUND: { status: 404, message: 'Category not found' },
        })
        .output(AdminCategoryDeleteResultSchema),
```

- JSDoc khối `destinations`: dòng đầu đổi thành
  `Điểm đến phía admin (spec P4e-2 F15) — năm thao tác, KHÔNG có sắp thứ tự (bảng không có cột `order`).`;
  thay đoạn "Không xoá vì khoá ngoại … (spec §2a)." bằng: "Xoá chỉ khi chưa tour nào dùng
  (ADR-0053): khoá ngoại `tour_destinations` khai `ON DELETE CASCADE` nên DB không chặn — server
  khoá hàng điểm đến, đếm liên kết, rồi mới xoá trong cùng transaction."
- Trong `destinations`, sau `setActive`:

```ts
      delete: oc
        .route({
          method: 'POST',
          path: '/api/admin/destinations/{id}/delete',
          summary: 'Delete a destination that no tour visits',
        })
        .input(AdminDestinationDeleteInputSchema)
        .errors({
          IN_USE: { status: 409, message: 'This destination is still used by tours' },
          NOT_FOUND: { status: 404, message: 'Destination not found' },
        })
        .output(AdminDestinationDeleteResultSchema),
```

- [ ] **Step 4: Chạy, thấy xanh; build lại contract**

Run: `pnpm --filter @tourism/contract exec vitest run`
Expected: PASS.
Run: `pnpm turbo run build --filter=@tourism/contract --concurrency=1`
Expected: build xanh.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/contract/src/schemas/admin-categories.ts libs/shared/contract/src/schemas/admin-destinations.ts libs/shared/contract/src/contract.ts libs/shared/contract/src/schemas/admin-categories.spec.ts libs/shared/contract/src/schemas/admin-destinations.spec.ts
git commit -m "feat(contract): thêm lệnh xoá danh mục và điểm đến cùng số tour mọi trạng thái"
```

(Typecheck API và admin sẽ đỏ ở chỗ dựng hàng thiếu `linkedTourCount` cho tới hết Task 7 và
Task 9–10 — đúng thứ tự, không phải lỗi.)

---

### Task 6: API — xoá danh mục, `linkedTourCount`

**Files:**

- Modify: `apps/api/src/modules/catalog/admin-categories.service.ts`
- Modify: `apps/api/src/modules/catalog/admin-categories.controller.ts`
- Modify: `apps/api/src/modules/catalog/admin-categories.int.spec.ts`

**Interfaces:**

- Consumes: `AdminCategoryDeleteInput`, `AdminCategoryDeleteResult` (Task 5)
- Produces: `AdminCategoriesService.delete(input): Promise<AdminCategoryDeleteResult>`,
  `CategoryInUseError` (`ContractError<'IN_USE'>`)

- [ ] **Step 1: Int test (đỏ)**

Trong `admin-categories.int.spec.ts`:

- Thêm helper cạnh `move`:

```ts
  const remove = (id: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/categories/${id}/delete`,
      headers: { cookie },
      payload: {},
    });
```

- Khối `guard`: ca 403 thêm `expect((await remove(catId(4), customerCookie)).statusCode).toBe(403);`;
  ca 401 đổi tên thành `'chưa đăng nhập thì cả sáu đường đều 401'` và thêm
  `expect((await remove(catId(4), anon)).statusCode).toBe(401);`.
- Ca `'`tourCount` đếm tour ĐÃ ĐĂNG, không đếm nháp'` thêm ở cuối:

```ts
      // ADR-0053 §5: số MỌI trạng thái quyết nút Delete — tour nháp vẫn chặn xoá.
      expect(rows.find((row) => row.slug === 'day-trips')?.linkedTourCount).toBe(2);
      expect(rows.find((row) => row.slug === 'packages')?.linkedTourCount).toBe(0);
```

- Thêm khối mới trước `describe('move')`:

```ts
  describe('delete (ADR-0053)', () => {
    const draftIn = (categoryId: string) =>
      prisma.tour.create({
        data: {
          slug: 'draft-only',
          title: 'Draft only',
          categoryId,
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: false,
        } as unknown as Prisma.TourCreateInput,
      });

    it('0 tour → 200 trả slug, hàng biến khỏi bảng', async () => {
      const res = await remove(catId(3), adminCookie);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ slug: 'cruises' });
      expect(await slugsInOrder()).toEqual(['day-trips', 'packages', 'retired']);
    });

    it('còn tour NHÁP → 409 IN_USE, hàng còn nguyên', async () => {
      await draftIn(catId(2));

      const res = await remove(catId(2), adminCookie);

      expect(res.statusCode).toBe(409);
      expect((res.json() as { code: string }).code).toBe('IN_USE');
      expect(await slugsInOrder()).toContain('packages');
    });

    it('id lạ → 404 NOT_FOUND', async () => {
      const res = await remove(catId(999), adminCookie);
      expect(res.statusCode).toBe(404);
      expect((res.json() as { code: string }).code).toBe('NOT_FOUND');
    });

    it('xoá chen với move ở hai hàng kề: không lượt nào 500, `order` không trùng', async () => {
      const results = await Promise.all([
        remove(catId(3), adminCookie),
        move(catId(2), 'down', adminCookie),
        move(catId(4), 'up', adminCookie),
      ]);

      for (const res of results) expect(res.statusCode).toBeLessThan(500);
      const orders = (await listOk()).map((row) => row.order);
      expect(new Set(orders).size).toBe(orders.length);
    });

    it('bust `tours` SAU commit; xoá hỏng thì không bust', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await remove(catId(3), adminCookie);
      expect(revalidate).toHaveBeenCalledTimes(1);
      expect(revalidate.mock.calls[0]?.[0]).toEqual(['tours']);

      revalidate.mockClear();
      await draftIn(catId(2));
      await remove(catId(2), adminCookie);
      await remove(catId(999), adminCookie);
      expect(revalidate).not.toHaveBeenCalled();
    });
  });
```

Nếu file chưa lấy `web` (WebRevalidationService) như spec điểm đến, thêm biến
`let web: WebRevalidationService;` và gán `web = moduleRef.get(WebRevalidationService);` trong
`beforeAll` (import `WebRevalidationService` từ `../web-revalidation/web-revalidation.service.js`).

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/admin-categories.int.spec.ts`
Expected: FAIL (route `/delete` chưa có, `linkedTourCount` undefined).

- [ ] **Step 2: Service**

Trong `admin-categories.service.ts`:

1. Import thêm `AdminCategoryDeleteInput`, `AdminCategoryDeleteResult` từ `@tourism/contract`.
2. Sửa JSDoc đầu file: thay đoạn "KHÔNG có lệnh xoá, … dành cho máy." bằng:

```ts
 * Xoá chỉ khi chưa tour nào dùng (ADR-0053, thay quyết định "chỉ bật/tắt" của spec P4e-2
 * §2a). Khoá ngoại `tours.category_id` khai `RESTRICT`, nên chính câu DELETE là phán quyết.
```

3. Thêm lỗi sau `CannotMoveError`:

```ts
/** Còn tour (mọi trạng thái) thuộc danh mục — ẩn thay vì xoá (ADR-0053). */
export class CategoryInUseError extends ContractError<'IN_USE'> {
  constructor() {
    super('IN_USE', 'This category is still used by tours');
  }
}
```

4. Thay `CATEGORY_SELECT_WITH_COUNT`, kiểu `CategoryWithCount`, `toRow`, `toRowWithCount` bằng:

```ts
/**
 * Cùng `CATEGORY_SELECT` nhưng kèm cờ `isPublished` của MỌI tour thuộc danh mục, trong CÙNG
 * một lần đọc với hàng (bài học 3 của vòng review F14). Hai con số suy từ CÙNG một danh
 * sách nên luôn `tourCount ≤ linkedTourCount`: `tourCount` nuôi câu cảnh báo lúc tắt (đếm
 * thứ khách đang thấy), `linkedTourCount` quyết nút Delete (ADR-0053 §5). Danh mục vài
 * hàng, tour vài chục — đọc cờ từng tour rẻ.
 */
const CATEGORY_SELECT_WITH_TOURS = {
  ...CATEGORY_SELECT,
  tours: { select: { isPublished: true } },
} satisfies Prisma.TourCategorySelect;

type CategoryData = Prisma.TourCategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;
type CategoryWithTours = Prisma.TourCategoryGetPayload<{
  select: typeof CATEGORY_SELECT_WITH_TOURS;
}>;

/** Hai con số tour của một hàng — xem `CATEGORY_SELECT_WITH_TOURS`. */
interface TourCounts {
  tourCount: number;
  linkedTourCount: number;
}

function countTours(tours: ReadonlyArray<{ isPublished: boolean }>): TourCounts {
  return {
    tourCount: tours.filter((tour) => tour.isPublished).length,
    linkedTourCount: tours.length,
  };
}

/** Hàng DB → hàng contract. */
function toRow(row: CategoryData, counts: TourCounts): AdminCategoryRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    order: row.order,
    isActive: row.isActive,
    tourCount: counts.tourCount,
    linkedTourCount: counts.linkedTourCount,
  };
}

/** Hàng đã kèm cờ tour — đếm ngay từ chính lần đọc đã lấy hàng. */
function toRowWithTours(row: CategoryWithTours): AdminCategoryRow {
  return toRow(row, countTours(row.tours));
}
```

   Giữ nguyên JSDoc cũ của `toRow` về `tourCount` (gộp vào JSDoc mới nếu cần), rồi đổi mọi chỗ
   `CATEGORY_SELECT_WITH_COUNT` → `CATEGORY_SELECT_WITH_TOURS`, `toRowWithCount` →
   `toRowWithTours`, và trong `create`: `return toRow(created, { tourCount: 0, linkedTourCount: 0 });`.

5. Thêm phương thức trước `bust()`:

```ts
  /**
   * Xoá một danh mục chưa tour nào dùng (ADR-0053 §2). Không SELECT kiểm trước (bài học 1–2
   * của vòng review F14): khoá ngoại `RESTRICT` nổ `P2003` ngay ở câu DELETE khi còn tour
   * (kể cả tour nháp) → `IN_USE`; hàng không còn → `P2025` → `NOT_FOUND`.
   *
   * Chạy trong `withCategoryOrderLock`: xoá một hàng đổi tập hàng xóm mà `move` đọc, nên nó
   * cũng là lệnh ghi chạm vị trí tương đối của danh sách.
   */
  async delete(input: AdminCategoryDeleteInput): Promise<AdminCategoryDeleteResult> {
    const deleted = await withCategoryOrderLock((tx) =>
      tx.tourCategory.delete({ where: { id: input.id }, select: { slug: true } }),
    ).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') throw new CategoryInUseError();
        if (error.code === 'P2025') throw new CategoryNotFoundError(input.id);
      }
      throw error;
    });

    this.logger.log(
      `[admin] category deleted ${JSON.stringify({ id: input.id, slug: deleted.slug })}`,
    );
    this.bust();
    return { slug: deleted.slug };
  }
```

- [ ] **Step 3: Controller**

Trong `admin-categories.controller.ts`, thêm (cùng khuôn các thủ tục khác của file):

```ts
  @Implement(contract.admin.categories.delete)
  delete() {
    return implement(contract.admin.categories.delete).handler(async ({ input, errors }) => {
      try {
        return await this.categories.delete(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
```

Đổi tên biến service cho khớp file nếu không phải `this.categories`.

- [ ] **Step 4: Chạy, thấy xanh**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/admin-categories.int.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/catalog/admin-categories.service.ts apps/api/src/modules/catalog/admin-categories.controller.ts apps/api/src/modules/catalog/admin-categories.int.spec.ts
git commit -m "feat(api): cho xoá danh mục chưa tour nào dùng, trả thêm số tour mọi trạng thái"
```

---

### Task 7: API — xoá điểm đến dưới khoá hàng, `linkedTourCount`

**Files:**

- Modify: `apps/api/src/modules/catalog/admin-destinations.service.ts`
- Modify: `apps/api/src/modules/catalog/admin-destinations.controller.ts`
- Modify: `apps/api/src/modules/catalog/admin-destinations.int.spec.ts`

**Interfaces:**

- Consumes: `AdminDestinationDeleteInput`, `AdminDestinationDeleteResult` (Task 5)
- Produces: `AdminDestinationsService.delete(input)`, `DestinationInUseError`

- [ ] **Step 1: Int test (đỏ)**

Trong `admin-destinations.int.spec.ts`:

- `beforeEach`: trước `await prisma.tour.deleteMany();` thêm

```ts
    // media_assets là bảng đa chủ, không khoá ngoại (ADR-0048) — dọn để ca này không nhặt
    // dòng ảnh của ca trước.
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaGarbage.deleteMany();
```

- Helper `remove` cạnh `setActive`:

```ts
  const remove = (id: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/destinations/${id}/delete`,
      headers: { cookie },
      payload: {},
    });
```

- Khối `guard`: thêm `remove(destId(1), …)` vào cả hai ca (403, 401); đổi tên ca thành
  "đủ năm đường".
- Ca `'`tourCount` đếm tour ĐÃ ĐĂNG …'` thêm:

```ts
      // ADR-0053 §5: tour nháp vẫn chặn xoá.
      expect(rows.find((row) => row.slug === 'hoi-an')?.linkedTourCount).toBe(2);
      expect(rows.find((row) => row.slug === 'retired')?.linkedTourCount).toBe(0);
```

- Khối mới trước `describe('bust cache web')`:

```ts
  describe('delete (ADR-0053)', () => {
    const PUBLIC_ID = 'tourism/destinations/hoi-an/lanterns';

    it('0 tour → xoá hàng và dòng ảnh thư viện; dòng ảnh tour mượn cùng publicId còn', async () => {
      const borrower = await tourVisiting('borrower', [destId(2)]);
      await prisma.mediaAsset.createMany({
        data: [
          {
            ownerType: 'DESTINATION',
            ownerId: destId(1),
            publicId: PUBLIC_ID,
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 1,
          },
          {
            ownerType: 'TOUR',
            ownerId: borrower.id,
            publicId: PUBLIC_ID,
            type: 'IMAGE',
            role: 'hero',
            sortOrder: 0,
          },
        ],
      });

      const res = await remove(destId(1), adminCookie);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ slug: 'hoi-an' });
      expect(await prisma.destination.count({ where: { id: destId(1) } })).toBe(0);
      expect(
        await prisma.mediaAsset.count({ where: { ownerType: 'DESTINATION', ownerId: destId(1) } }),
      ).toBe(0);
      expect(await prisma.mediaAsset.count({ where: { ownerId: borrower.id } })).toBe(1);
      // ADR-0053 §4: file Cloudinary KHÔNG vào hàng dọn — tour đang dùng nó.
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('còn liên kết với tour NHÁP → 409 IN_USE, không gì đổi', async () => {
      await tourVisiting('draft-one', [destId(1)], false);

      const res = await remove(destId(1), adminCookie);

      expect(res.statusCode).toBe(409);
      expect((res.json() as { code: string }).code).toBe('IN_USE');
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(1) } })).toBe(1);
    });

    it('id lạ → 404 NOT_FOUND', async () => {
      const res = await remove(destId(999), adminCookie);
      expect(res.statusCode).toBe(404);
      expect((res.json() as { code: string }).code).toBe('NOT_FOUND');
    });

    it('đua: lệnh gắn tour giữ khoá trước → lệnh xoá thấy liên kết, trả 409', async () => {
      // ADR-0053 §3. Thiếu `FOR UPDATE` thì lệnh xoá đếm 0 (liên kết chưa commit), chờ khoá
      // ở câu DELETE, rồi CASCADE gỡ đúng liên kết vừa commit: 200 và tour mất điểm đến.
      const tour = await tourVisiting('racing-tour', [destId(2)]);
      let inserted!: () => void;
      const didInsert = new Promise<void>((resolve) => {
        inserted = resolve;
      });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const linking = prisma.$transaction(
        async (tx) => {
          await tx.tourDestination.create({
            data: { tourId: tour.id, destinationId: destId(1), isPrimary: false },
          });
          inserted();
          await gate;
        },
        { timeout: 15_000 },
      );
      await didInsert;

      const deleting = remove(destId(1), adminCookie);
      // Cho lệnh xoá kịp tới chỗ chờ khoá hàng rồi mới commit lệnh gắn.
      await new Promise((resolve) => setTimeout(resolve, 300));
      release();
      await linking;
      const res = await deleting;

      expect(res.statusCode).toBe(409);
      expect(await prisma.tourDestination.count({ where: { destinationId: destId(1) } })).toBe(1);
    });
  });
```

- Trong `describe('bust cache web')`, thêm:

```ts
    it('xoá bust `tours` sau commit; xoá hỏng thì không bust', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await remove(destId(3), adminCookie);
      expect(revalidate).toHaveBeenCalledTimes(1);
      expect(revalidate.mock.calls[0]?.[0]).toEqual(['tours']);

      revalidate.mockClear();
      await tourVisiting('draft-one', [destId(1)], false);
      await remove(destId(1), adminCookie);
      await remove(destId(999), adminCookie);
      expect(revalidate).not.toHaveBeenCalled();
    });
```

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/admin-destinations.int.spec.ts`
Expected: FAIL.

- [ ] **Step 2: Service**

Trong `admin-destinations.service.ts`:

1. Import thêm `AdminDestinationDeleteInput`, `AdminDestinationDeleteResult`; thêm
   `import { MediaOwnerType } from '../../generated/prisma/enums.js';`.
2. JSDoc đầu file: thay đoạn "KHÔNG có lệnh xoá, … (spec §2a)." bằng:

```ts
 * Xoá chỉ khi chưa tour nào dùng (ADR-0053, thay quyết định "chỉ ẩn" của spec P4e-2 §2a).
 * Khoá ngoại `tour_destinations_destination_id_fkey` khai `ON DELETE CASCADE` nên DB KHÔNG
 * chặn — `delete` khoá hàng điểm đến rồi đếm liên kết trong cùng transaction.
```

3. Thêm lỗi sau `DestinationSlugTakenError`:

```ts
/** Còn tour (mọi trạng thái) gắn điểm đến — ẩn thay vì xoá (ADR-0053). */
export class DestinationInUseError extends ContractError<'IN_USE'> {
  constructor() {
    super('IN_USE', 'This destination is still used by tours');
  }
}
```

4. Thay `DESTINATION_SELECT` và `DESTINATION_WRITE_SELECT` bằng (giữ JSDoc cũ, sửa câu về đếm):

```ts
/**
 * Cột của một hàng KÈM cờ `isPublished` của mọi tour gắn nó, trong CÙNG một lần đọc
 * (bài học 3 của vòng review F14). `tourCount` (tour ĐÃ ĐĂNG, nuôi câu cảnh báo lúc ẩn) và
 * `linkedTourCount` (mọi trạng thái, quyết nút Delete — ADR-0053 §5) suy từ CÙNG danh sách
 * nên luôn `tourCount ≤ linkedTourCount`.
 */
const DESTINATION_SELECT = {
  ...DESTINATION_COLUMNS,
  tours: { select: { tour: { select: { isPublished: true } } } },
} satisfies Prisma.DestinationSelect;

/**
 * Lệnh sửa và lệnh ẩn/hiện đọc thêm slug của MỌI tour gắn điểm đến, trong cùng câu ghi:
 * trang chi tiết `/tours/<slug>` in tên điểm đến qua tag `tour:<slug>`, nên bust riêng
 * `tours` thì trang ấy giữ tên cũ tới hết 300 giây ISR (nợ G5, đóng ở vòng review F15).
 */
const DESTINATION_WRITE_SELECT = {
  ...DESTINATION_COLUMNS,
  tours: { select: { tour: { select: { slug: true, isPublished: true } } } },
} satisfies Prisma.DestinationSelect;
```

5. Thêm cạnh `toRow`:

```ts
/** Hai con số tour của một hàng — xem `DESTINATION_SELECT`. */
interface TourCounts {
  tourCount: number;
  linkedTourCount: number;
}

function countTours(links: ReadonlyArray<{ tour: { isPublished: boolean } }>): TourCounts {
  return {
    tourCount: links.filter((link) => link.tour.isPublished).length,
    linkedTourCount: links.length,
  };
}
```

   `toRow(row, tourCount: number)` đổi thành `toRow(row: DestinationColumns, counts: TourCounts)`
   trả thêm `linkedTourCount: counts.linkedTourCount` (và `tourCount: counts.tourCount`). Các chỗ
   gọi:
   - `list`: `rows.map((row) => toRow(row, countTours(row.tours)))`
   - `create`: `toRow(created, { tourCount: 0, linkedTourCount: 0 })`
   - `update`, `setActive`: `toRow(updated, countTours(updated.tours))`

6. Thêm phương thức trước `bust()`:

```ts
  /**
   * Xoá một điểm đến chưa tour nào dùng (ADR-0053 §3–4), MỘT transaction:
   *
   * 1. `SELECT … FOR UPDATE` hàng điểm đến — câu chèn liên kết tour mới phải giành
   *    `FOR KEY SHARE` trên chính hàng ấy (phép kiểm khoá ngoại), mà hai khoá này xung đột,
   *    nên không lệnh gắn nào chen vào giữa lúc đếm và lúc xoá. Lệnh gắn đến SAU lượt xoá
   *    thì nhận `P2003` — mã "điểm đến không tồn tại" có sẵn của khu sửa tour.
   * 2. Đếm `tour_destinations` ở statement SAU khoá (snapshot mới, thấy mọi thứ đã commit);
   *    còn dòng → `IN_USE`.
   * 3. Xoá dòng `media_assets` chủ `DESTINATION` (bảng đa chủ, không khoá ngoại). KHÔNG
   *    `requeue` publicId nào: ảnh thư viện là ảnh catalog dùng chung, tour mượn nó bằng
   *    dòng của riêng tour (ADR-0048 §3, §6).
   * 4. Xoá điểm đến.
   */
  async delete(input: AdminDestinationDeleteInput): Promise<AdminDestinationDeleteResult> {
    const deleted = await prisma.$transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<{ slug: string }[]>(Prisma.sql`
          SELECT slug FROM destinations WHERE id = ${input.id}::uuid FOR UPDATE
        `);
        if (!locked) throw new DestinationNotFoundError(input.id);
        const links = await tx.tourDestination.count({ where: { destinationId: input.id } });
        if (links > 0) throw new DestinationInUseError();
        await tx.mediaAsset.deleteMany({
          where: { ownerType: MediaOwnerType.DESTINATION, ownerId: input.id },
        });
        await tx.destination.delete({ where: { id: input.id } });
        return locked;
      },
      { timeout: 10_000, maxWait: 5_000 },
    );

    this.logger.log(
      `[admin] destination deleted ${JSON.stringify({ id: input.id, slug: deleted.slug })}`,
    );
    // Không tour nào gắn điểm đến này nên không có trang `tour:<slug>` nào phải bust kèm.
    this.bust(['tours']);
    return { slug: deleted.slug };
  }
```

- [ ] **Step 3: Controller**

Trong `admin-destinations.controller.ts`, thêm:

```ts
  @Implement(contract.admin.destinations.delete)
  delete() {
    return implement(contract.admin.destinations.delete).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.delete(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
```

- [ ] **Step 4: Chạy, thấy xanh; typecheck API**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/admin-destinations.int.spec.ts`
Expected: PASS.
Run: `pnpm --filter @tourism/api typecheck`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/catalog/admin-destinations.service.ts apps/api/src/modules/catalog/admin-destinations.controller.ts apps/api/src/modules/catalog/admin-destinations.int.spec.ts
git commit -m "feat(api): cho xoá điểm đến chưa tour nào dùng, kiểm liên kết dưới khoá hàng"
```

---

### Task 8: Kit cho lệnh xoá — `TourCountCell` và `DeleteRowAction`

**Files:**

- Create: `apps/admin/src/components/kit/tour-count-cell.tsx`, `tour-count-cell.spec.tsx`
- Create: `apps/admin/src/components/kit/delete-row-action.tsx`, `delete-row-action.spec.tsx`

**Interfaces:**

- Produces:
  - `TourCountCell({ total: number; totalLabel: string; publishedLabel: string | null })`
  - `DeleteRowAction<Code extends string>({ label, actionLabel, blockedReason, disabled, dialog, onSettled })`
    với `dialog: { copy: ConfirmWriteCopy & { noteLabel?: undefined }; rows: ConfirmWriteRow[]; isStale(code): boolean; errorCopy(code): string; onSubmit(): Promise<ConfirmWriteResult<Code>> }`

- [ ] **Step 1: Spec (đỏ)**

`tour-count-cell.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TourCountCell } from './tour-count-cell';

/** Ô Tours của bảng danh mục và điểm đến (spec 2026-10-05 §3.3). */
describe('TourCountCell', () => {
  it('có tour: tổng là dòng chính, số đang bán là dòng mờ', () => {
    render(<TourCountCell total={5} totalLabel="5 tours" publishedLabel="3 published" />);
    expect(screen.getByText('5 tours')).toBeInTheDocument();
    expect(screen.getByText('3 published')).toHaveClass('text-muted-foreground');
  });

  it('0 tour: một chữ mờ, không có dòng thứ hai', () => {
    render(<TourCountCell total={0} totalLabel="No tours" publishedLabel={null} />);
    expect(screen.getByText('No tours')).toHaveClass('text-muted-foreground');
  });
});
```

`delete-row-action.spec.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteRowAction } from './delete-row-action';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Nút Delete của một hàng bảng catalog (spec 2026-10-05 §3.3, ADR-0053 §5): hàng còn tour
 * thì khoá kiểu `aria-disabled` và tooltip nói vì sao; hết tour thì mở hộp xác nhận đỏ.
 */
const COPY = {
  title: 'Delete this category?',
  body: 'No tour uses this category.',
  warning: 'This cannot be undone.',
  submit: 'Delete category',
  submitting: 'Deleting…',
  cancel: 'Cancel',
};

function renderAction(
  props: Partial<React.ComponentProps<typeof DeleteRowAction<'IN_USE' | 'NOT_FOUND'>>> = {},
) {
  const onSubmit = vi.fn().mockResolvedValue({
    ok: true,
    toast: { title: 'Category deleted', description: 'Cruises is gone.' },
  });
  const onSettled = vi.fn();
  render(
    <DeleteRowAction<'IN_USE' | 'NOT_FOUND'>
      label="Delete"
      actionLabel="Delete Cruises"
      blockedReason={null}
      disabled={false}
      dialog={{
        copy: COPY,
        rows: [{ label: 'Category', value: 'Cruises' }],
        isStale: () => false,
        errorCopy: () => 'error',
        onSubmit,
      }}
      onSettled={onSettled}
      {...props}
    />,
  );
  return { onSubmit, onSettled, button: screen.getByRole('button', { name: 'Delete Cruises' }) };
}

describe('DeleteRowAction', () => {
  it('còn tour: nút khoá nhưng vẫn rê được, tooltip nói lý do, bấm không mở hộp', async () => {
    const user = userEvent.setup();
    const { button } = renderAction({ blockedReason: 'Used by 2 tours — hide it instead.' });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.hover(button);
    expect(await screen.findByText('Used by 2 tours — hide it instead.')).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('0 tour: mở hộp đỏ, xác nhận thì gửi lệnh rồi làm mới bảng', async () => {
    const user = userEvent.setup();
    const { button, onSubmit, onSettled } = renderAction();

    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: COPY.title });
    expect(within(dialog).getByText('Cruises')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: COPY.submit }));

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('bảng đang làm mới: nút khoá, không tooltip', () => {
    const { button } = renderAction({ disabled: true });
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
```

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit/tour-count-cell.spec.tsx src/components/kit/delete-row-action.spec.tsx --maxWorkers=4`
Expected: FAIL — module chưa có.

- [ ] **Step 2: `tour-count-cell.tsx`**

```tsx
/**
 * Ô "Tours" của bảng danh mục và điểm đến (spec 2026-10-05 §3.3). Tổng tour MỌI trạng thái
 * là dòng chính — chính con số quyết nút Delete (ADR-0053 §5) — còn số tour đang bán là dòng
 * mờ bên dưới. 0 tour thì một chữ mờ: hàng ấy là hàng xoá được.
 *
 * Kit chứ không nằm ở vùng: hai bảng dùng y hệt (luật kit ≥ 2 consumer). Chữ do VM nấu sẵn.
 */
export function TourCountCell({
  total,
  totalLabel,
  publishedLabel,
}: {
  total: number;
  totalLabel: string;
  publishedLabel: string | null;
}) {
  if (total === 0) {
    return <span className="whitespace-nowrap text-muted-foreground">{totalLabel}</span>;
  }
  return (
    <div className="grid leading-tight">
      <span className="whitespace-nowrap tabular-nums">{totalLabel}</span>
      {publishedLabel ? (
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {publishedLabel}
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: `delete-row-action.tsx`**

```tsx
'use client';

import { Button } from '@tourism/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tourism/ui/components/tooltip';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import {
  ConfirmWriteDialog,
  type ConfirmWriteCopy,
  type ConfirmWriteResult,
  type ConfirmWriteRow,
} from '@/components/kit/confirm-write-dialog';
import type { TransportFailureCode } from '@/lib/api/write-error';

/**
 * Nút Delete của một hàng bảng catalog kèm hộp xác nhận giọng đỏ (spec 2026-10-05 §3.3,
 * ADR-0053 §5). Kit vì hai bảng (danh mục, điểm đến) dùng y hệt.
 *
 * Hàng còn tour (`blockedReason` khác `null`) thì nút khoá kiểu `aria-disabled`
 * (`focusableWhenDisabled`): vẫn nhận focus, và `aria-disabled:pointer-events-auto` cho nó
 * nhận chuột — thiếu nó thì biến thể `aria-disabled:pointer-events-none` của `Button` nuốt
 * mất cú rê, và tooltip, thứ DUY NHẤT nói vì sao không bấm được, không bao giờ hiện. Server
 * vẫn là phán quyết cuối: bảng có thể cũ hơn DB.
 */
export function DeleteRowAction<Code extends string>({
  label,
  actionLabel,
  blockedReason,
  disabled,
  dialog,
  onSettled,
}: {
  /** Chữ trên nút ("Delete"). */
  label: string;
  /** Tên đọc-màn-hình mang tên hàng ("Delete Cruises"). */
  actionLabel: string;
  /** Lý do không xoá được; `null` là xoá được. */
  blockedReason: string | null;
  /** Bảng đang kéo dữ liệu tươi về — khoá như các nút khác của hàng. */
  disabled: boolean;
  dialog: {
    copy: ConfirmWriteCopy & { noteLabel?: undefined };
    rows: ConfirmWriteRow[];
    isStale: (code: Code | TransportFailureCode) => boolean;
    errorCopy: (code: Code | TransportFailureCode) => string;
    onSubmit: () => Promise<ConfirmWriteResult<Code>>;
  };
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const blocked = blockedReason !== null;

  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={actionLabel}
      disabled={disabled || blocked}
      // Khoá mà vẫn nhận focus — cùng lý do các nút khác của hàng (vòng review F15).
      focusableWhenDisabled
      className="text-destructive-emphasis hover:text-destructive-emphasis aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed"
      onClick={() => setOpen(true)}
    >
      <Trash2Icon data-icon="inline-start" aria-hidden="true" />
      {label}
    </Button>
  );

  return (
    <>
      {blocked ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={button} />
            <TooltipContent>{blockedReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      {open ? (
        <ConfirmWriteDialog<Code>
          copy={dialog.copy}
          rows={dialog.rows}
          submitVariant="destructive"
          warningTone="destructive"
          isStale={dialog.isStale}
          errorCopy={dialog.errorCopy}
          onSubmit={dialog.onSubmit}
          onClose={() => setOpen(false)}
          onSettled={onSettled}
        />
      ) : null}
    </>
  );
}
```

Nếu `ConfirmWriteCopy`, `ConfirmWriteResult`, `ConfirmWriteRow` chưa được export từ
`confirm-write-dialog.tsx`, thêm `export` cho chúng (chúng đã là `export interface/type` ở dòng
65, 81, 86 — kiểm lại).

- [ ] **Step 4: Chạy, thấy xanh**

Run lại lệnh Step 1. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/kit/tour-count-cell.tsx apps/admin/src/components/kit/tour-count-cell.spec.tsx apps/admin/src/components/kit/delete-row-action.tsx apps/admin/src/components/kit/delete-row-action.spec.tsx
git commit -m "feat(admin): thêm ô đếm tour và nút xoá có tooltip vào kit"
```

---

### Task 9: Admin — xoá danh mục

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `admin.categories`)
- Modify: `apps/admin/src/lib/api/categories.ts`
- Modify: `apps/admin/src/lib/categories-write.ts` và spec
- Modify: `apps/admin/src/lib/categories-view.ts` và spec
- Modify: `apps/admin/src/app/(admin)/categories/actions.ts`, `page.tsx`
- Modify: `apps/admin/src/components/categories/categories-table.tsx`
- Modify: `apps/admin/src/components/categories/category-row-actions.tsx` và spec

**Interfaces:**

- Consumes: `TourCountCell`, `DeleteRowAction` (Task 8); `AdminCategoryDeleteInput`,
  `AdminCategoryDeleteResult`, `AdminCategoryDeleteInputSchema` (Task 5)
- Produces:
  - `deleteAdminCategory(cookie, input): Promise<AdminCategoryDeleteResult>`
  - `DeleteCategoryAction`, `CategoryDeleteResult`, `DeleteContractCode`, `DELETE_CONTRACT_CODES`,
    `classifyDeleteError`, `deleteErrorCopy`, `isDeleteStale`, `deleteBlockedReason(row)`,
    `deleteDialogCopy()`, `deleteConfirmRows(row)`, `deleteToast(name)`
  - `CategoryRowVM.linkedTourCount: number`, `CategoryRowVM.publishedLabel: string | null`
  - `deleteCategoryAction` (server action); prop `remove: DeleteCategoryAction` trên
    `CategoriesTable` và `CategoryRowActions`

- [ ] **Step 1: i18n**

Khối `admin.categories.list`:

- `columns.tours: 'Published tours'` → `columns.tours: 'Tours'`.
- Sau dòng `tours: (count: number) => …` thêm:

```ts
        /** Dòng mờ dưới tổng tour: số đang bán (spec 2026-10-05 §3.3). */
        published: (count: number) => `${count} published`,
        noTours: 'No tours',
```

Khối `admin.categories`, sau `move: {…}` thêm:

```ts
      /** Xoá danh mục chưa tour nào dùng (ADR-0053). */
      delete: {
        action: 'Delete',
        actionLabel: (name: string) => `Delete ${name}`,
        inUse: (count: number) =>
          count === 1
            ? 'Used by 1 tour — hide it instead.'
            : `Used by ${count} tours — hide it instead.`,
        rows: { category: 'Category', slug: 'Slug' },
        dialog: {
          title: 'Delete this category?',
          body: 'No tour uses this category, so nothing else changes. Its slug can be used again.',
          warning: 'This cannot be undone.',
          submit: 'Delete category',
          submitting: 'Deleting…',
        },
        /** Mã của contract `admin.categories.delete` — `createWriteErrorCodec` derive từ keys. */
        errors: {
          IN_USE:
            'A tour started using this category a moment ago, so it can’t be deleted. Hide it instead.',
          NOT_FOUND: 'This category no longer exists. The table has been refreshed.',
        },
        toast: { title: 'Category deleted', body: (name: string) => `${name} is gone.` },
      },
```

Run: `pnpm turbo run build --filter=@tourism/i18n --concurrency=1`

- [ ] **Step 2: Test lib (đỏ)**

`categories-write.spec.ts` thêm (import thêm `contract` từ `@tourism/contract` và các hàm mới):

```ts
describe('lệnh xoá (ADR-0053)', () => {
  it('tập mã khớp đúng errorMap của contract', () => {
    expect([...DELETE_CONTRACT_CODES].sort()).toEqual(
      Object.keys(contract.admin.categories.delete['~orpc'].errorMap).sort(),
    );
  });

  it('IN_USE và NOT_FOUND đều là trạng thái cũ: đóng hộp, làm mới bảng', () => {
    expect(isDeleteStale('IN_USE')).toBe(true);
    expect(isDeleteStale('NOT_FOUND')).toBe(true);
  });

  it('còn tour thì nói lý do, số ít và số nhiều; hết tour thì xoá được', () => {
    expect(deleteBlockedReason({ linkedTourCount: 1 })).toBe('Used by 1 tour — hide it instead.');
    expect(deleteBlockedReason({ linkedTourCount: 3 })).toBe('Used by 3 tours — hide it instead.');
    expect(deleteBlockedReason({ linkedTourCount: 0 })).toBeNull();
  });

  it('hộp xác nhận kể tên và slug của hàng', () => {
    expect(deleteConfirmRows({ name: 'Cruises', slug: 'cruises' })).toEqual([
      { label: 'Category', value: 'Cruises' },
      { label: 'Slug', value: 'cruises' },
    ]);
  });
});
```

`categories-view.spec.ts`: factory `row(n, over)` của file thêm `linkedTourCount: 0,` vào object
mặc định, và thêm ca:

```ts
  it('ô Tours: tổng mọi trạng thái là dòng chính, số đang bán là dòng phụ; 0 thì "No tours"', () => {
    const [busy, empty] = toCategoryRowVMs([
      row(1, { tourCount: 3, linkedTourCount: 5 }),
      row(2, { tourCount: 0, linkedTourCount: 0 }),
    ]);
    expect(busy?.toursLabel).toBe('5 tours');
    expect(busy?.publishedLabel).toBe('3 published');
    expect(busy?.linkedTourCount).toBe(5);
    expect(empty?.toursLabel).toBe('No tours');
    expect(empty?.publishedLabel).toBeNull();
  });
```

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/categories-write.spec.ts src/lib/categories-view.spec.ts --maxWorkers=4`
Expected: FAIL.

- [ ] **Step 3: Lib**

`lib/api/categories.ts` thêm (import thêm hai kiểu delete):

```ts
export async function deleteAdminCategory(
  cookie: string,
  input: AdminCategoryDeleteInput,
): Promise<AdminCategoryDeleteResult> {
  return api.admin.categories.delete(input, { context: withAdminAuth(cookie) });
}
```

`lib/categories-write.ts` thêm (import thêm `AdminCategoryDeleteInput`,
`AdminCategoryDeleteResult`; `TransportFailureCode` đã có):

```ts
// ── Lệnh xoá (ADR-0053) ─────────────────────────────────────────────────────

/**
 * `IN_USE` là "trạng thái cũ" như `NOT_FOUND`: bảng nói hàng 0 tour mà DB đã có tour gắn
 * vào. Đóng hộp và làm mới bảng — sau lượt làm mới, nút Delete khoá kèm tooltip, đúng chỗ
 * admin cần nhìn (plan 2026-10-05, quyết định 3).
 */
const deleteCodec = createWriteErrorCodec(t.delete.errors, { stale: ['IN_USE', 'NOT_FOUND'] });

export const DELETE_CONTRACT_CODES = deleteCodec.codes;
export type DeleteContractCode = keyof typeof t.delete.errors;
export const classifyDeleteError = deleteCodec.classify;
export const deleteErrorCopy = deleteCodec.copy;
export const isDeleteStale = deleteCodec.isStale;

export type CategoryDeleteResult =
  | { ok: true; deleted: AdminCategoryDeleteResult }
  | { ok: false; code: DeleteContractCode | TransportFailureCode };

export type DeleteCategoryAction = (
  input: AdminCategoryDeleteInput,
) => Promise<CategoryDeleteResult>;

/** Lý do nút Delete khoá; `null` là xoá được (ADR-0053 §5). */
export function deleteBlockedReason(row: { linkedTourCount: number }): string | null {
  return row.linkedTourCount > 0 ? t.delete.inUse(row.linkedTourCount) : null;
}

export function deleteDialogCopy() {
  const d = t.delete.dialog;
  return {
    title: d.title,
    body: d.body,
    warning: d.warning,
    submit: d.submit,
    submitting: d.submitting,
    cancel: t.form.cancel,
  };
}

export function deleteConfirmRows(row: {
  name: string;
  slug: string;
}): Array<{ label: string; value: string }> {
  return [
    { label: t.delete.rows.category, value: row.name },
    { label: t.delete.rows.slug, value: row.slug },
  ];
}

export function deleteToast(name: string) {
  return { title: t.delete.toast.title, description: t.delete.toast.body(name) };
}
```

`lib/categories-view.ts`:

- `CategoryRowVM` thêm `linkedTourCount: number;` và `publishedLabel: string | null;`, kèm JSDoc
  `/** Tổng tour mọi trạng thái — quyết nút Delete (ADR-0053 §5). */` và
  `/** Dòng mờ "N published" dưới tổng; `null` khi 0 tour. */`.
- Trong `toCategoryRowVMs`:

```ts
    tourCount: row.tourCount,
    linkedTourCount: row.linkedTourCount,
    toursLabel: row.linkedTourCount === 0 ? t.list.noTours : t.list.tours(row.linkedTourCount),
    publishedLabel: row.linkedTourCount === 0 ? null : t.list.published(row.tourCount),
```

Run lại lệnh Step 2. Expected: PASS.

- [ ] **Step 4: Server action và trang**

`app/(admin)/categories/actions.ts` thêm (import `AdminCategoryDeleteInput`,
`AdminCategoryDeleteInputSchema`, `AdminCategoryDeleteResult`, `deleteAdminCategory`,
`classifyDeleteError`, `CategoryDeleteResult`):

```ts
export async function deleteCategoryAction(
  input: AdminCategoryDeleteInput,
): Promise<CategoryDeleteResult> {
  const parsed = AdminCategoryDeleteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let deleted: AdminCategoryDeleteResult;
  try {
    deleted = await deleteAdminCategory(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyDeleteError(error) };
  }
  return { ok: true, deleted };
}
```

Sửa JSDoc đầu file nếu nó đếm số hành vi ghi ("BỐN" → "NĂM").
`page.tsx`: import `deleteCategoryAction`, truyền `remove={deleteCategoryAction}` cho
`<CategoriesTable>`.

- [ ] **Step 5: Test hàng (đỏ)**

`category-row-actions.spec.tsx`:

- factory `row(n, over)` thêm `linkedTourCount: 0,` vào object mặc định;
- trong `renderRow`, trước `render(...)` thêm

```tsx
  const remove = vi.fn(async () => ({
    ok: true as const,
    deleted: { slug: rows[index]?.slug ?? '' },
  }));
  const onSettled = vi.fn();
```

  truyền `remove={remove}` và đổi `onSettled={vi.fn()}` thành `onSettled={onSettled}`; giá trị trả
  về thành `{ vm, update, setActive, move, onMoveStart, remove, onSettled }`;
- thêm hai ca (import `waitFor`, `within` nếu thiếu):

```tsx
  it('còn tour: nút Delete khoá, rê chuột thấy "Used by N tours"', async () => {
    const user = userEvent.setup();
    renderRow([row(1, { tourCount: 1, linkedTourCount: 2 })], 0);

    const button = screen.getByRole('button', { name: t.delete.actionLabel('Category 1') });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.hover(button);
    expect(await screen.findByText(t.delete.inUse(2))).toBeInTheDocument();
  });

  it('0 tour: xác nhận gửi đúng id, toast tên hàng, rồi làm mới bảng', async () => {
    const user = userEvent.setup();
    const { remove, onSettled } = renderRow([row(1)], 0);

    await user.click(screen.getByRole('button', { name: t.delete.actionLabel('Category 1') }));
    const dialog = await screen.findByRole('dialog', { name: t.delete.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.delete.dialog.submit }));

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(remove).toHaveBeenCalledWith({ id: row(1).id });
    expect(success).toHaveBeenCalledWith(t.delete.toast.title, {
      description: t.delete.toast.body('Category 1'),
    });
  });
```

Run: `pnpm --filter @tourism/admin exec vitest run src/components/categories --maxWorkers=4`
Expected: FAIL.

- [ ] **Step 6: Component**

`category-row-actions.tsx`:

- Import `DeleteRowAction` từ `@/components/kit/delete-row-action` và từ `@/lib/categories-write`:
  `type DeleteCategoryAction`, `type DeleteContractCode`, `deleteBlockedReason`,
  `deleteConfirmRows`, `deleteDialogCopy`, `deleteErrorCopy`, `deleteToast`, `isDeleteStale`.
- Prop mới `remove: DeleteCategoryAction;` (JSDoc: `/** Lệnh xoá (ADR-0053) — trang chở xuống. */`).
- Sửa JSDoc đầu component: hàng có thêm nút Delete, bật khi 0 tour.
- Sau nút Hide/Show:

```tsx
      <DeleteRowAction<DeleteContractCode>
        label={t.delete.action}
        actionLabel={t.delete.actionLabel(row.name)}
        blockedReason={deleteBlockedReason(row)}
        disabled={disabled}
        dialog={{
          copy: deleteDialogCopy(),
          rows: deleteConfirmRows(row),
          isStale: isDeleteStale,
          errorCopy: deleteErrorCopy,
          onSubmit: async () => {
            const result = await remove({ id: row.id });
            if (!result.ok) return { ok: false, code: result.code };
            return { ok: true, toast: deleteToast(row.name) };
          },
        }}
        onSettled={onSettled}
      />
```

`categories-table.tsx`:

- `CategoriesTableProps` thêm `remove: DeleteCategoryAction;`; `ActionsCell` nhận và chuyển
  `remove` xuống `CategoryRowActions`; `columns` deps thêm `remove`.
- Cột `toursLabel` đổi `cell` thành:

```tsx
          cell: ({ row }) => (
            <TourCountCell
              total={row.original.linkedTourCount}
              totalLabel={row.original.toursLabel}
              publishedLabel={row.original.publishedLabel}
            />
          ),
```

  (import `TourCountCell` từ `@/components/kit/tour-count-cell`).

Run lại lệnh Step 5. Expected: PASS. Run `pnpm --filter @tourism/admin typecheck` — chỉ còn lỗi ở
vùng điểm đến (Task 10).

- [ ] **Step 7: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts apps/admin/src/lib/api/categories.ts apps/admin/src/lib/categories-write.ts apps/admin/src/lib/categories-write.spec.ts apps/admin/src/lib/categories-view.ts apps/admin/src/lib/categories-view.spec.ts "apps/admin/src/app/(admin)/categories/actions.ts" "apps/admin/src/app/(admin)/categories/page.tsx" apps/admin/src/components/categories
git commit -m "feat(admin): nút xoá danh mục chưa tour nào dùng, ô Tours đếm mọi trạng thái"
```

---

### Task 10: Admin — xoá điểm đến

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `admin.destinations`)
- Modify: `apps/admin/src/lib/api/destinations.ts`
- Modify: `apps/admin/src/lib/destinations-write.ts` và spec
- Modify: `apps/admin/src/lib/destinations-view.ts` và spec
- Modify: `apps/admin/src/app/(admin)/destinations/actions.ts`, `page.tsx`
- Modify: `apps/admin/src/components/destinations/destinations-table.tsx`
- Modify: `apps/admin/src/components/destinations/destination-row-actions.tsx` và spec

**Interfaces:**

- Consumes: Task 8; `AdminDestinationDeleteInput`, `AdminDestinationDeleteResult`,
  `AdminDestinationDeleteInputSchema` (Task 5)
- Produces: cùng bộ tên Task 9 trong `destinations-write.ts`, với
  `DeleteDestinationAction`, `DestinationDeleteResult`; `deleteAdminDestination`;
  `deleteDestinationAction`; `DestinationRowVM.linkedTourCount`, `DestinationRowVM.publishedLabel`

- [ ] **Step 1: i18n**

Khối `admin.destinations.list`: `columns.tours: 'Tours'`; thêm
`published: (count: number) => `${count} published`,` và `noTours: 'No tours',` sau `tours`.
Sau `setActive: {…}` của khối `admin.destinations` thêm:

```ts
      /** Xoá điểm đến chưa tour nào dùng (ADR-0053). */
      delete: {
        action: 'Delete',
        actionLabel: (name: string) => `Delete ${name}`,
        inUse: (count: number) =>
          count === 1
            ? 'Used by 1 tour — hide it instead.'
            : `Used by ${count} tours — hide it instead.`,
        rows: { destination: 'Destination', region: 'Region', slug: 'Slug' },
        dialog: {
          title: 'Delete this destination?',
          body: 'No tour goes to this destination. Its photos leave the photo library; tours keep any photos they already use.',
          warning: 'This cannot be undone.',
          submit: 'Delete destination',
          submitting: 'Deleting…',
        },
        /** Mã của contract `admin.destinations.delete` — `createWriteErrorCodec` derive từ keys. */
        errors: {
          IN_USE:
            'A tour started using this destination a moment ago, so it can’t be deleted. Hide it instead.',
          NOT_FOUND: 'This destination no longer exists. The table has been refreshed.',
        },
        toast: { title: 'Destination deleted', body: (name: string) => `${name} is gone.` },
      },
```

Nếu `NOT_FOUND` của `edit.errors` vùng này dùng câu khác, chép đúng câu ấy cho thống nhất.
Run: `pnpm turbo run build --filter=@tourism/i18n --concurrency=1`

- [ ] **Step 2: Test lib (đỏ)**

`destinations-write.spec.ts` thêm khối giống Task 9 Step 2, đổi `contract.admin.categories`
→ `contract.admin.destinations`, và ca dòng xác nhận:

```ts
  it('hộp xác nhận kể tên, vùng và slug', () => {
    expect(
      deleteConfirmRows({ name: 'Hội An', regionLabel: 'Central Vietnam', slug: 'hoi-an' }),
    ).toEqual([
      { label: 'Destination', value: 'Hội An' },
      { label: 'Region', value: 'Central Vietnam' },
      { label: 'Slug', value: 'hoi-an' },
    ]);
  });
```

`destinations-view.spec.ts`: factory `row(over)` thêm `linkedTourCount: 4,` vào object mặc định
(mặc định file có `tourCount: 4`), và thêm ca:

```ts
  it('ô Tours: tổng mọi trạng thái là dòng chính, số đang bán là dòng phụ; 0 thì "No tours"', () => {
    const busy = toDestinationRowVM(row({ tourCount: 3, linkedTourCount: 5 }));
    const empty = toDestinationRowVM(row({ tourCount: 0, linkedTourCount: 0 }));
    expect(busy.toursLabel).toBe('5 tours');
    expect(busy.publishedLabel).toBe('3 published');
    expect(empty.toursLabel).toBe('No tours');
    expect(empty.publishedLabel).toBeNull();
  });
```

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/destinations-write.spec.ts src/lib/destinations-view.spec.ts --maxWorkers=4`
Expected: FAIL.

- [ ] **Step 3: Lib**

`lib/api/destinations.ts`:

```ts
export async function deleteAdminDestination(
  cookie: string,
  input: AdminDestinationDeleteInput,
): Promise<AdminDestinationDeleteResult> {
  return api.admin.destinations.delete(input, { context: withAdminAuth(cookie) });
}
```

`lib/destinations-write.ts`: thêm khối giống Task 9 Step 3 (đổi tên kiểu thành
`DestinationDeleteResult`, `DeleteDestinationAction`, input `AdminDestinationDeleteInput`), với
`deleteConfirmRows`:

```ts
export function deleteConfirmRows(row: {
  name: string;
  regionLabel: string;
  slug: string;
}): Array<{ label: string; value: string }> {
  return [
    { label: t.delete.rows.destination, value: row.name },
    { label: t.delete.rows.region, value: row.regionLabel },
    { label: t.delete.rows.slug, value: row.slug },
  ];
}
```

`lib/destinations-view.ts`: `DestinationRowVM` thêm `linkedTourCount`, `publishedLabel`;
`toDestinationRowVM` thêm ba dòng như Task 9 Step 3.

Run lại lệnh Step 2. Expected: PASS.

- [ ] **Step 4: Server action và trang**

`app/(admin)/destinations/actions.ts` thêm `deleteDestinationAction` cùng khuôn
`deleteCategoryAction` (schema `AdminDestinationDeleteInputSchema`, gọi
`deleteAdminDestination`, phân loại bằng `classifyDeleteError` của `destinations-write`); JSDoc
đầu file đổi "BA hành vi ghi" → "BỐN hành vi ghi". `page.tsx` truyền
`remove={deleteDestinationAction}`.

- [ ] **Step 5: Test hàng (đỏ)**

`destination-row-actions.spec.tsx`:

- factory `row(over)` thêm `linkedTourCount: 4,` vào object mặc định;
- trong `renderRow`, trước `render(...)` thêm
  `const remove = vi.fn(async () => ({ ok: true as const, deleted: { slug: data.slug } }));` và
  `const onSettled = vi.fn();`, truyền `remove={remove}`, đổi `onSettled={vi.fn()}` thành
  `onSettled={onSettled}`, trả về `{ vm, update, setActive, remove, onSettled }`;
- thêm hai ca:

```tsx
  it('còn tour: nút Delete khoá, rê chuột thấy "Used by N tours"', async () => {
    const user = userEvent.setup();
    renderRow(row());

    const button = screen.getByRole('button', { name: t.delete.actionLabel('Hội An') });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.hover(button);
    expect(await screen.findByText(t.delete.inUse(4))).toBeInTheDocument();
  });

  it('0 tour: xác nhận gửi đúng id, toast tên hàng, rồi làm mới bảng', async () => {
    const user = userEvent.setup();
    const data = row({ tourCount: 0, linkedTourCount: 0 });
    const { remove, onSettled } = renderRow(data);

    await user.click(screen.getByRole('button', { name: t.delete.actionLabel('Hội An') }));
    const dialog = await screen.findByRole('dialog', { name: t.delete.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.delete.dialog.submit }));

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(remove).toHaveBeenCalledWith({ id: data.id });
    expect(success).toHaveBeenCalledWith(t.delete.toast.title, {
      description: t.delete.toast.body('Hội An'),
    });
  });
```

Run: `pnpm --filter @tourism/admin exec vitest run src/components/destinations --maxWorkers=4`
Expected: FAIL.

- [ ] **Step 6: Component**

`destination-row-actions.tsx`: sửa JSDoc đầu (bỏ câu "KHÔNG có nút xoá…", thay bằng "Delete
bật khi 0 tour — ADR-0053"); prop `remove: DeleteDestinationAction`; sau nút Hide/Show thêm khối
`DeleteRowAction` như Task 9 Step 6 (đổi import sang `@/lib/destinations-write`).

`destinations-table.tsx`: prop `remove`, chuyển xuống hàng, deps `columns` thêm `remove`; cột
Tours dùng `TourCountCell` như Task 9.

Run lại lệnh Step 5, rồi `pnpm --filter @tourism/admin typecheck`.
Expected: PASS và typecheck sạch.

- [ ] **Step 7: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts apps/admin/src/lib/api/destinations.ts apps/admin/src/lib/destinations-write.ts apps/admin/src/lib/destinations-write.spec.ts apps/admin/src/lib/destinations-view.ts apps/admin/src/lib/destinations-view.spec.ts "apps/admin/src/app/(admin)/destinations/actions.ts" "apps/admin/src/app/(admin)/destinations/page.tsx" apps/admin/src/components/destinations
git commit -m "feat(admin): nút xoá điểm đến chưa tour nào dùng"
```

---

### Task 11: Quick Create thành menu tạo nhanh

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (`admin.shell`)
- Create: `apps/admin/src/lib/create-param.ts`, `create-param.spec.ts`
- Create: `apps/admin/src/components/kit/strip-create-param.tsx`, `strip-create-param.spec.tsx`
- Create: `apps/admin/src/components/quick-create-menu.tsx`, `quick-create-menu.spec.tsx`
- Modify: `apps/admin/src/components/nav-main.tsx` và spec
- Modify: `apps/admin/src/components/tours/editor/new-tour-dialog.tsx` và spec; `components/tours/tours-table.tsx`
- Modify: `apps/admin/src/components/posts/new-post-dialog.tsx` và spec; `components/posts/posts-table.tsx`
- Modify: `apps/admin/src/components/categories/categories-table.tsx`, `destinations/destinations-table.tsx`
- Modify: bốn `page.tsx` của `tours`, `posts`, `categories`, `destinations`
- Create: `apps/admin/src/components/categories/categories-table.spec.tsx`, `destinations/destinations-table.spec.tsx`

**Interfaces:**

- Produces:
  - `CREATE_PARAM = 'create'`, `createHref(path: string): string`,
    `wantsCreate(params: RawSearchParams): boolean`,
    `withoutCreateParam(pathname: string, search: string): string`
  - `StripCreateParam()` (client, render `null`)
  - `QuickCreateMenu()`
  - prop `openCreate?: boolean` trên `NewTourDialog`, `ToursTable`, `NewPostDialog`, `PostsTable`,
    `CategoriesTable`, `DestinationsTable`

- [ ] **Step 1: i18n**

Khối `admin.shell`, sau `logoTooltip`:

```ts
      /** Nút tạo nhanh trên sidebar và nhãn nhóm của menu nó mở (spec 2026-10-05 §2.5). */
      quickCreate: 'Quick Create',
      quickCreateMenu: 'Create',
```

Build lại i18n.

- [ ] **Step 2: `create-param` (đỏ rồi xanh)**

`create-param.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CREATE_PARAM, createHref, wantsCreate, withoutCreateParam } from './create-param';

/** Tham số URL của Quick Create (spec 2026-10-05 §2.5). */
describe('create-param', () => {
  it('createHref gắn `create=1` vào trang vùng', () => {
    expect(createHref('/categories')).toBe('/categories?create=1');
    expect(CREATE_PARAM).toBe('create');
  });

  it('wantsCreate chỉ nhận đúng giá trị 1', () => {
    expect(wantsCreate({ create: '1' })).toBe(true);
    expect(wantsCreate({ create: '0' })).toBe(false);
    expect(wantsCreate({})).toBe(false);
    expect(wantsCreate({ create: ['1', '1'] })).toBe(false);
  });

  it('withoutCreateParam gỡ riêng `create`, giữ mọi tham số khác', () => {
    expect(withoutCreateParam('/tours', 'create=1&status=live')).toBe('/tours?status=live');
    expect(withoutCreateParam('/tours', 'create=1')).toBe('/tours');
  });
});
```

`create-param.ts`:

```ts
import type { RawSearchParams } from '@/lib/table-query';

/**
 * Tham số URL mà menu Quick Create gắn vào để trang vùng mở sẵn hộp tạo (spec 2026-10-05
 * §2.5). Trang đọc nó ở server rồi truyền prop `openCreate`; `StripCreateParam` gỡ nó khỏi
 * URL ngay sau đó để F5 hay Back không mở lại hộp.
 */
export const CREATE_PARAM = 'create';

export function createHref(path: string): string {
  return `${path}?${CREATE_PARAM}=1`;
}

/** `?create=1` đúng một lần, đúng giá trị `1` — mảng hay giá trị khác đều không tính. */
export function wantsCreate(params: RawSearchParams): boolean {
  return params[CREATE_PARAM] === '1';
}

export function withoutCreateParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CREATE_PARAM);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
```

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/create-param.spec.ts --maxWorkers=4`
(viết spec trước, chạy đỏ, rồi viết module, chạy xanh).

- [ ] **Step 3: `StripCreateParam` (đỏ rồi xanh)**

`kit/strip-create-param.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StripCreateParam } from './strip-create-param';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tours',
  useSearchParams: () => new URLSearchParams('create=1&status=live'),
}));

describe('StripCreateParam', () => {
  it('gỡ `create` khỏi URL ngay sau mount, giữ tham số khác, không cuộn trang', () => {
    render(<StripCreateParam />);
    expect(replace).toHaveBeenCalledWith('/tours?status=live', { scroll: false });
  });
});
```

`kit/strip-create-param.tsx`:

```tsx
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { CREATE_PARAM, withoutCreateParam } from '@/lib/create-param';

/**
 * Gỡ `?create=1` khỏi URL ngay sau khi trang đã mở hộp tạo (spec 2026-10-05 §2.5) — F5 hay
 * Back không mở lại hộp. Tách thành component riêng để bảng và hộp tạo KHÔNG phải đọc URL
 * (spec của chúng mock `next/navigation` chỉ có `useRouter`).
 */
export function StripCreateParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams.has(CREATE_PARAM)) return;
    router.replace(withoutCreateParam(pathname, searchParams.toString()), { scroll: false });
  }, [router, pathname, searchParams]);

  return null;
}
```

- [ ] **Step 4: `QuickCreateMenu` (đỏ rồi xanh)**

`quick-create-menu.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { SidebarProvider } from '@tourism/ui/components/sidebar';
import { TooltipProvider } from '@tourism/ui/components/tooltip';
import { describe, expect, it } from 'vitest';
import { QuickCreateMenu } from './quick-create-menu';

/** Quick Create (spec 2026-10-05 §2.5): bốn mục, mỗi mục mở trang vùng với hộp tạo bật sẵn. */
describe('QuickCreateMenu', () => {
  it('mở ra bốn mục, mỗi mục trỏ `?create=1` của đúng trang', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <QuickCreateMenu />
        </SidebarProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: messages.admin.shell.quickCreate }));

    const expected = [
      [messages.admin.tours.editor.create.action, '/tours?create=1'],
      [messages.admin.posts.create.action, '/posts?create=1'],
      [messages.admin.categories.create.action, '/categories?create=1'],
      [messages.admin.destinations.create.action, '/destinations?create=1'],
    ] as const;
    for (const [name, href] of expected) {
      expect(await screen.findByRole('menuitem', { name })).toHaveAttribute('href', href);
    }
  });
});
```

`quick-create-menu.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@tourism/ui/components/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@tourism/ui/components/tooltip';
import { CirclePlusIcon, Compass, FileText, MapPin, Tags } from 'lucide-react';
import Link from 'next/link';
import { createHref } from '@/lib/create-param';

/**
 * Nút Quick Create của sidebar thành MENU tạo nhanh (spec 2026-10-05 §2.5) — trước đây là
 * nút chép nguyên từ block dashboard-01, không gắn hành động nào. Nhãn mỗi mục là đúng chữ
 * nút tạo của vùng ấy, icon là icon của vùng trên sidebar (`lib/nav.ts`).
 *
 * Khuôn trigger y như `NavUser`: menu mở bên phải khi sidebar thu về cột icon, bên dưới khi
 * mở rộng; tooltip chỉ hiện ở cột icon (nhãn đã nằm cạnh icon khi mở rộng).
 */
const ITEMS = [
  {
    key: 'tour',
    href: createHref('/tours'),
    label: messages.admin.tours.editor.create.action,
    icon: Compass,
  },
  { key: 'post', href: createHref('/posts'), label: messages.admin.posts.create.action, icon: FileText },
  {
    key: 'category',
    href: createHref('/categories'),
    label: messages.admin.categories.create.action,
    icon: Tags,
  },
  {
    key: 'destination',
    href: createHref('/destinations'),
    label: messages.admin.destinations.create.action,
    icon: MapPin,
  },
] as const;

export function QuickCreateMenu() {
  const { isMobile, state } = useSidebar();
  const t = messages.admin.shell;
  const collapsed = state === 'collapsed' && !isMobile;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <Tooltip>
            <DropdownMenuTrigger
              render={
                <TooltipTrigger
                  render={
                    <SidebarMenuButton className="min-w-8 bg-sidebar-cta text-sidebar-cta-foreground duration-200 ease-linear hover:bg-sidebar-primary hover:text-sidebar-primary-foreground active:bg-sidebar-primary active:text-sidebar-primary-foreground aria-expanded:bg-sidebar-primary aria-expanded:text-sidebar-primary-foreground" />
                  }
                />
              }
            >
              <CirclePlusIcon aria-hidden="true" />
              <span>{t.quickCreate}</span>
            </DropdownMenuTrigger>
            <TooltipContent side="right" hidden={!collapsed}>
              {t.quickCreate}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            className="min-w-56"
            side={collapsed ? 'right' : 'bottom'}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t.quickCreateMenu}</DropdownMenuLabel>
              {ITEMS.map((item) => (
                <DropdownMenuItem key={item.key} render={<Link href={item.href} />}>
                  <item.icon aria-hidden="true" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

Chạy spec đỏ trước khi viết component, xanh sau.

- [ ] **Step 5: `NavMain` dùng menu, gỡ nút phong bì**

Thêm vào `nav-main.spec.tsx`:

```tsx
  it('nút phong bì đã bỏ; Quick Create là nút mở menu', () => {
    renderNav({ open: true });
    expect(screen.queryByRole('button', { name: 'Inbox' })).toBeNull();
    expect(
      screen.getByRole('button', { name: messages.admin.shell.quickCreate }),
    ).toHaveAttribute('aria-haspopup', 'menu');
  });
```

(import `messages` từ `@tourism/i18n`). Chạy, thấy đỏ.

Trong `nav-main.tsx`:

- Thay cả khối `<SidebarGroup>` Quick Create (từ comment "Khối Quick Create" tới `</SidebarGroup>`
  đầu tiên) bằng:

```tsx
      {/* Quick Create thành menu tạo nhanh (spec 2026-10-05 §2.5). Nút phong bì của block
          dashboard-01 bỏ hẳn: không có đích, và Enquiries đã có mục riêng ở nhóm Operations. */}
      <SidebarGroup>
        <SidebarGroupContent>
          <QuickCreateMenu />
        </SidebarGroupContent>
      </SidebarGroup>
```

- Bỏ import `Button`, `CirclePlusIcon`, `MailIcon`; thêm `import { QuickCreateMenu } from '@/components/quick-create-menu';`.
- Sửa JSDoc đầu `NavMain`: bỏ câu "GIỮ nguyên khối Quick Create + nút mail của block…", thay bằng
  "Quick Create là menu tạo nhanh (05/10, user chốt), nút mail của block đã bỏ."

Chạy lại spec nav-main, thấy xanh.

- [ ] **Step 6: `openCreate` cho bốn chỗ mở hộp tạo (đỏ rồi xanh)**

Spec mới, mỗi spec một ca:

- `new-tour-dialog.spec.tsx`:

```tsx
  it('`openCreate` (Quick Create) mở sẵn hộp mà không cần bấm nút', async () => {
    render(<NewTourDialog options={OPTIONS} create={vi.fn()} openCreate />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
```

  (`OPTIONS` là hằng `TourEditorOptions` sẵn có của file).
- `new-post-dialog.spec.tsx`: như trên với `<NewPostDialog create={vi.fn()} openCreate />`.
- `categories-table.spec.tsx` (mới):

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { toCategoryRowVMs } from '@/lib/categories-view';
import { CategoriesTable } from './categories-table';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

describe('CategoriesTable — Quick Create', () => {
  it('`openCreate` mở sẵn hộp Add category', async () => {
    render(
      <CategoriesTable
        rows={toCategoryRowVMs([
          {
            id: 'c1400001-0000-4000-8000-000000000001',
            slug: 'day-trips',
            name: 'Day trips',
            description: null,
            order: 1,
            isActive: true,
            tourCount: 0,
            linkedTourCount: 0,
          },
        ])}
        create={vi.fn()}
        update={vi.fn()}
        setActive={vi.fn()}
        move={vi.fn()}
        remove={vi.fn()}
        openCreate
      />,
    );
    expect(
      await screen.findByRole('dialog', { name: messages.admin.categories.create.dialog.title }),
    ).toBeInTheDocument();
  });
});
```

- `destinations-table.spec.tsx` (mới): tương tự với `toDestinationRowVM` (hàng
  `{ id, slug: 'hoi-an', name: 'Hội An', country: 'Vietnam', region: 'Central Vietnam', description: null, isActive: true, tourCount: 0, linkedTourCount: 0 }`),
  props `create`, `update`, `setActive`, `remove`, `openCreate`, và tên hộp
  `messages.admin.destinations.create.dialog.title`.

Chạy bốn spec, thấy đỏ. Rồi sửa:

- `NewTourDialog` và `NewPostDialog`: thêm prop `openCreate = false` (JSDoc:
  `/** Quick Create (`?create=1`) — trang báo mở sẵn hộp (spec 2026-10-05 §2.5). */`), import
  `useEffect`, và ngay sau `useState` của `open`:

```tsx
  // Effect chứ không phải state khởi đầu: đang ở chính trang này mà bấm Quick Create thì
  // route giữ nguyên, chỉ query đổi — component không remount, `useState(openCreate)` vô tác dụng.
  useEffect(() => {
    if (openCreate) setOpen(true);
  }, [openCreate]);
```

- `CategoriesTable` và `DestinationsTable`: prop `openCreate?: boolean` (mặc định `false`), cùng
  effect trên với `setAdding(true)`.
- `ToursTable`: prop `openCreate?: boolean`, truyền `openCreate={openCreate}` xuống
  `<NewTourDialog>`. `PostsTable`: tương tự với `<NewPostDialog>`.

Chạy lại bốn spec, thấy xanh.

- [ ] **Step 7: Bốn trang đọc `create=1`**

- `tours/page.tsx` và `posts/page.tsx`: đọc `const raw = await searchParams;`, parse query từ
  `raw` như cũ, `const openCreate = wantsCreate(raw);`, truyền `openCreate={openCreate}` cho bảng,
  và render `{openCreate ? <StripCreateParam /> : null}` ngay sau bảng trong `AdminShell`.
- `categories/page.tsx` và `destinations/page.tsx`: thêm tham số
  `{ searchParams }: { searchParams: Promise<RawSearchParams> }` (import `RawSearchParams` từ
  `@/lib/table-query`), cùng ba dòng trên. Sửa JSDoc "KHÔNG có `searchParams`" thành "chỉ đọc
  `create=1` của Quick Create — bảng sáu hàng vẫn không phân trang, không lọc."

Run: `pnpm --filter @tourism/admin exec vitest run --maxWorkers=4 && pnpm --filter @tourism/admin typecheck`
Expected: PASS, typecheck sạch.

- [ ] **Step 8: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts apps/admin/src/lib/create-param.ts apps/admin/src/lib/create-param.spec.ts apps/admin/src/components/kit/strip-create-param.tsx apps/admin/src/components/kit/strip-create-param.spec.tsx apps/admin/src/components/quick-create-menu.tsx apps/admin/src/components/quick-create-menu.spec.tsx apps/admin/src/components/nav-main.tsx apps/admin/src/components/nav-main.spec.tsx apps/admin/src/components/tours apps/admin/src/components/posts apps/admin/src/components/categories apps/admin/src/components/destinations "apps/admin/src/app/(admin)/tours/page.tsx" "apps/admin/src/app/(admin)/posts/page.tsx" "apps/admin/src/app/(admin)/categories/page.tsx" "apps/admin/src/app/(admin)/destinations/page.tsx"
git commit -m "feat(admin): Quick Create thành menu mở sẵn hộp tạo của bốn vùng"
```

---

### Task 12: Báo khi Summary bị cắt ở thẻ "Card on /tours"

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (`admin.tours.editor.aside.preview`)
- Create: `apps/admin/src/components/tours/editor/clamped-summary.tsx`
- Modify: `apps/admin/src/components/tours/editor/step-aside.tsx:247`
- Modify: `apps/admin/src/components/tours/editor/step-aside.spec.tsx`

- [ ] **Step 1: i18n**

Trong `aside.preview`, sau `priceNote`:

```ts
            /**
             * Summary tràn hai dòng của khung (spec 2026-10-05 §4 #1). Khung ~290px chữ 12px
             * xấp xỉ card web trên điện thoại 360px — màn rộng card in được nhiều hơn.
             */
            summaryCut: 'The card cuts this after two lines; the tour page shows all of it.',
```

Build lại i18n.

- [ ] **Step 2: Spec (đỏ)**

Trong `describe('TourCardPreview')` của `step-aside.spec.tsx` thêm (import `afterEach` nếu thiếu):

```tsx
  describe('Summary dài hơn hai dòng', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function fakeLayout(scrollHeight: number) {
      // jsdom không dựng layout — giả hai thước đo của đoạn bị kẹp hai dòng.
      vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
      vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(32);
    }

    it('tràn: hiện câu báo card cắt sau hai dòng', async () => {
      fakeLayout(64);
      render(<TourCardPreview preview={PREVIEW} />);
      expect(await screen.findByText(a.preview.summaryCut)).toBeInTheDocument();
    });

    it('vừa hai dòng: không báo gì', () => {
      fakeLayout(32);
      render(<TourCardPreview preview={PREVIEW} />);
      expect(screen.queryByText(a.preview.summaryCut)).toBeNull();
    });
  });
```

Run: `pnpm --filter @tourism/admin exec vitest run src/components/tours/editor/step-aside.spec.tsx --maxWorkers=4`
Expected: FAIL ở ca "tràn".

- [ ] **Step 3: `clamped-summary.tsx`**

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { useEffect, useRef, useState } from 'react';

const a = messages.admin.tours.editor.aside;

/**
 * Summary của thẻ xem trước, kẹp hai dòng như card web (spec 2026-10-05 §4 #1). Không bung
 * hết chữ: card thật vẫn cắt, khung xem trước mà cho đọc đủ là nói dối. Thay vào đó đo tràn
 * (`scrollHeight > clientHeight` — đoạn cao cố định `2lh`) và tràn thì nói thẳng ra.
 *
 * Đo lại khi chữ đổi và khi bề rộng khung đổi (ResizeObserver); jsdom không có
 * ResizeObserver nên chỉ đo một lần.
 */
export function ClampedSummary({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: đo lại mỗi khi chữ đổi
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setCut(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <>
      {/* Giữ chỗ 2 dòng như card web: tóm tắt rỗng không làm thẻ co lại. */}
      <p ref={ref} className="line-clamp-2 h-[2lh] text-xs text-muted-foreground">
        {text}
      </p>
      {cut ? <p className="text-xs text-muted-foreground">{a.preview.summaryCut}</p> : null}
    </>
  );
}
```

Nếu Biome báo comment `biome-ignore` thừa (deps đã đúng), bỏ dòng ấy.

- [ ] **Step 4: Dùng trong `TourCardPreview`**

`step-aside.tsx`: import `ClampedSummary` từ `@/components/tours/editor/clamped-summary`; thay hai
dòng ở 246–247 (comment "Giữ chỗ 2 dòng…" và `<p className="line-clamp-2 …">`) bằng
`<ClampedSummary text={preview.summary} />`.

Run lại lệnh Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts apps/admin/src/components/tours/editor/clamped-summary.tsx apps/admin/src/components/tours/editor/step-aside.tsx apps/admin/src/components/tours/editor/step-aside.spec.tsx
git commit -m "feat(admin): báo khi Summary bị cắt ở thẻ xem trước card tour"
```

---

### Task 13: Hộp Reject review — rộng hơn, thanh cuộn có làn riêng

**Files:**

- Modify: `apps/admin/src/components/reviews/reject-review-dialog.tsx:108,114,132`
- Modify: `apps/admin/src/components/reviews/reject-review-dialog.spec.tsx`

- [ ] **Step 1: Spec (đỏ)**

Thêm vào spec (helper `openReject` và fixture `PENDING` sẵn có của file):

```tsx
  it('bố cục: hộp ~1024px, cột lý do ~320px, vùng cuộn chừa làn cho thanh cuộn', async () => {
    const { dialog } = await openReject(PENDING);
    expect(dialog).toHaveClass('sm:max-w-5xl');
    const list = within(dialog).getByRole('radiogroup');
    expect(list).toHaveClass('pr-3');
    expect(list).toHaveClass('[scrollbar-gutter:stable]');
    expect(list.parentElement?.parentElement).toHaveClass(
      'md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]',
    );
  });
```

(`openRejectDialog` là tên ví dụ — dùng đúng helper mà file đang dùng để render hộp.)

Run: `pnpm --filter @tourism/admin exec vitest run src/components/reviews/reject-review-dialog.spec.tsx --maxWorkers=4`
Expected: FAIL.

- [ ] **Step 2: Sửa class**

- Dòng 107–108: comment đổi thành `{/* Rộng hơn mọi dialog moderation khác (~1024px): cột lý do nằm bên trái. */}`
  và `'sm:max-w-4xl'` → `'sm:max-w-5xl'`.
- Dòng 114: `md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]` → `md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]`.
- Dòng 132: `className="max-h-80 gap-1.5 overflow-y-auto md:max-h-[26rem]"` →
  `className="max-h-80 gap-1.5 overflow-y-auto pr-3 [scrollbar-gutter:stable] md:max-h-[26rem]"`,
  kèm comment phía trên RadioGroup:
  `{/* `pr-3` + `scrollbar-gutter: stable`: thanh cuộn có làn riêng, không dính sát thẻ lý do,
  và danh sách lọc còn ngắn không làm các thẻ giật ngang (góp ý user 05/10). */}`

Run lại lệnh Step 1. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/reviews/reject-review-dialog.tsx apps/admin/src/components/reviews/reject-review-dialog.spec.tsx
git commit -m "fix(admin): nới hộp Reject review và chừa làn cho thanh cuộn danh sách lý do"
```

---

### Task 14: Ảnh thu nhỏ — xin ảnh nhỏ, ảnh hỏng có dấu hiệu

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (`admin.table.photoUnavailable`)
- Create: `apps/admin/src/components/kit/safe-img.tsx`, `safe-img.spec.tsx`
- Modify: `apps/admin/src/lib/tours-view.ts` (`heroUrl` → `thumbUrl`) và spec
- Modify: `apps/admin/src/components/tours/tours-table.tsx:176-198` và spec nếu có dùng `heroUrl`
- Modify: `apps/admin/src/components/posts/posts-table.tsx:107-125`
- Modify: `apps/admin/src/components/reviews/review-moderation-context.tsx:28-45`

- [ ] **Step 1: i18n** — khối `admin.table` thêm `photoUnavailable: 'Photo unavailable',`; build i18n.

- [ ] **Step 2: Spec (đỏ)**

`kit/safe-img.spec.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { SafeImg } from './safe-img';

/** Ô ảnh của admin (spec 2026-10-05 §4 #13): ảnh hỏng thành icon có tên, không thành ô trống. */
describe('SafeImg', () => {
  it('ảnh tải được: một <img> lazy với alt cho sẵn', () => {
    const { container } = render(
      <SafeImg src="https://res.cloudinary.com/demo/x.jpg" alt="" width={40} height={40} className="size-10" />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('ảnh lỗi: thay bằng ô có tên "Photo unavailable"', () => {
    const { container } = render(
      <SafeImg src="https://res.cloudinary.com/demo/gone.jpg" alt="" width={40} height={40} className="size-10" />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(
      screen.getByRole('img', { name: messages.admin.table.photoUnavailable }),
    ).toHaveClass('size-10');
  });
});
```

`tours-view.spec.ts`: ca dựng VM kiểm `thumbUrl` mang `w_160`:

```ts
  it('ảnh bìa xin bản 160px cho ô 40px — không tải ảnh gốc', () => {
    const vm = toTourRowVM({
      ...ROW,
      heroUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v17/tourism/x',
    });
    expect(vm.thumbUrl).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_160/v17/tourism/x',
    );
  });
```

(`ROW` là fixture `AdminTourRow` sẵn có của file; dạng URL theo đúng `tourPhotoThumb` ở
`tour-editor-view.spec.ts` dòng 210–212, chỉ khác `w_320` → `w_160`.)

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit/safe-img.spec.tsx src/lib/tours-view.spec.ts --maxWorkers=4`
Expected: FAIL.

- [ ] **Step 3: `safe-img.tsx`**

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { ImageOffIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Ô ảnh thu nhỏ của admin (spec 2026-10-05 §4 #13). Ảnh hỏng — Cloudinary đã xoá, hay một
 * tham chiếu treo như review của nợ G22 — hiện icon kèm tên "Photo unavailable" thay cho ô
 * xám trống không nói gì.
 *
 * `<img>` thường chứ không `next/image`: URL Cloudinary đã mang sẵn `f_auto,q_auto`
 * (ADR-0005), và `next/image` ném khi host nằm ngoài `remotePatterns`.
 *
 * Ngoài `onError`, đo lại một lần sau mount: ảnh hỏng TRƯỚC khi React hydrate thì sự kiện
 * `error` đã trôi qua. `complete && naturalWidth === 0` là "tải xong mà không có ảnh".
 */
export function SafeImg({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Cỡ ô (vd `size-10`) — áp cho cả ảnh lẫn ô thay thế để bố cục không giật. */
  className?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    const image = ref.current;
    if (image?.complete && image.naturalWidth === 0) setBroken(true);
  }, [src]);

  if (broken) {
    return (
      <span
        role="img"
        aria-label={messages.admin.table.photoUnavailable}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border border-dashed bg-muted text-muted-foreground',
          className,
        )}
      >
        <ImageOffIcon aria-hidden="true" className="size-4" />
      </span>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: thumbnail cỡ cố định, URL Cloudinary đã tối ưu (ADR-0005)
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={cn('shrink-0 rounded-md object-cover', className)}
    />
  );
}
```

- [ ] **Step 4: Ba nơi dùng**

- `tours-view.ts`: `heroUrl: string | null` → `thumbUrl: string | null` (JSDoc: "Ảnh bìa thu về
  160px cho ô 40px — cùng nếp `posts-view`"); `heroUrl: row.heroUrl,` →
  `thumbUrl: row.heroUrl === null ? null : withDeliveryTransform(row.heroUrl, 'w_160'),`
  (import `withDeliveryTransform` từ `./cloudinary-url`).
- `tours-table.tsx` `TourThumb`: `row.heroUrl` → `row.thumbUrl`; khối `<img …/>` thay bằng
  `<SafeImg src={row.thumbUrl} alt="" width={40} height={40} className="size-10" />` (xoá dòng
  `biome-ignore` cũ, import `SafeImg`). Sửa JSDoc của `TourThumb` cho đúng (`w_160`, ảnh hỏng).
- `posts-table.tsx` thumb: thay `<img …/>` bằng
  `<SafeImg src={row.thumbUrl} alt="" width={40} height={40} className="size-10" />`.
- `review-moderation-context.tsx`: thay `<img key=… />` bằng
  `<SafeImg key={photo.thumb} src={photo.thumb} alt={photo.alt} width={64} height={64} className="size-16 rounded-sm border border-border" />`
  (giữ khối comment giải thích lý do không dùng `next/image`, bỏ dòng `biome-ignore`).

Grep spec còn dùng `heroUrl` của VM bảng: `grep -rn "heroUrl" apps/admin/src/components/tours/*.spec.tsx apps/admin/src/lib/tours-view.spec.ts`
— đổi thành `thumbUrl` ở fixture VM (không đổi fixture hàng contract).

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit src/components/tours src/components/posts src/components/reviews src/lib --maxWorkers=4`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts apps/admin/src/components/kit/safe-img.tsx apps/admin/src/components/kit/safe-img.spec.tsx apps/admin/src/lib/tours-view.ts apps/admin/src/lib/tours-view.spec.ts apps/admin/src/components/tours/tours-table.tsx apps/admin/src/components/posts/posts-table.tsx apps/admin/src/components/reviews/review-moderation-context.tsx
git commit -m "fix(admin): ảnh thu nhỏ bảng Tours xin bản 160px, ảnh hỏng hiện dấu hiệu"
```

(Thêm vào `git add` mọi spec đã sửa ở Step 4.)

---

### Task 15: Subscribers — nút Export hết đè; Outbox — hết cuộn ngang

**Files:**

- Modify: `apps/admin/src/components/subscribers/subscribers-table.tsx:115-140`
- Create: `apps/admin/src/components/subscribers/subscribers-table.spec.tsx`
- Modify: `apps/admin/src/components/outbox/outbox-table.tsx:84,103,130`

- [ ] **Step 1: Spec Subscribers (đỏ)**

```tsx
import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { parseSubscribersSearchParams } from '@/lib/subscribers-query';
import { SubscribersTable } from './subscribers-table';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/subscribers',
  useSearchParams: () => new URLSearchParams(),
}));

const t = messages.admin.subscribers.list;

describe('SubscribersTable — nút Export', () => {
  it('nằm TRONG ô tiêu đề cột Actions, nên không đè chữ của cột nào', () => {
    render(
      <SubscribersTable
        rows={[
          {
            id: '5b1a0000-0000-4000-8000-000000000001',
            email: 'reader@example.com',
            source: 'Footer',
            subscribed: '1 Oct 2026',
            confirmed: '1 Oct 2026',
            unsubscribed: 'Still subscribed',
            isActive: true,
          },
        ]}
        query={parseSubscribersSearchParams({})}
        sources={[]}
        total={1}
        totalPages={1}
        unsubscribe={vi.fn()}
      />,
    );

    const header = screen.getByRole('columnheader', { name: new RegExp(t.columns.actions) });
    expect(within(header).getByRole('link', { name: t.exportCsv })).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @tourism/admin exec vitest run src/components/subscribers/subscribers-table.spec.tsx --maxWorkers=4`
Expected: FAIL — link nằm ở cột `export` riêng.

- [ ] **Step 2: Gộp cột**

Trong `buildColumns` của `subscribers-table.tsx`, xoá cả `columnHelper.display({ id: 'export', … })`
và đổi cột `actions` thành:

```tsx
    columnHelper.display({
      id: 'actions',
      /**
       * Nút Export sống trong CHÍNH ô tiêu đề cột Actions (spec 2026-10-05 §4 #4). Bản trước
       * dựng một cột `export` rộng 0 sát mép phải, nút tràn sang trái và đè chữ "Actions"
       * (còn đọc được "Acti"). Ở đây cột có bề rộng thật, ít nhất bằng nút. Chữ "Actions"
       * còn cho trình đọc màn hình.
       */
      header: () => (
        <div className="flex items-center justify-end">
          <span className="sr-only">{t.columns.actions}</span>
          <SubscribersExportLink query={query} total={total} />
        </div>
      ),
      // Chỉ hàng CÒN nhận tin mới có nút: bấm lên hàng đã huỷ chỉ ra 409, và một nút luôn
      // hỏng là một nút không nên vẽ.
      cell: ({ row }) =>
        row.original.isActive ? (
          <div className="flex justify-end">
            <UnsubscribeAction row={row.original} unsubscribe={unsubscribe} />
          </div>
        ) : null,
      enableHiding: false,
    }),
```

Sửa JSDoc đầu file (đoạn "Nút Export sống trong Ô TIÊU ĐỀ của cột `export`…") cho khớp.

Run lại lệnh Step 1. Expected: PASS.

- [ ] **Step 3: Outbox thu hẹp cột**

`outbox-table.tsx`:

- dòng 84: `<div className="max-w-64">` → `<div className="max-w-52">`
- dòng 103: `max-w-56 truncate` → `max-w-48 truncate`
- dòng 130: `max-w-64 truncate font-mono text-xs` → `max-w-40 truncate font-mono text-xs`

Thêm comment phía trên `buildColumns`:
`// Ba trần bề rộng (Type, Recipient, Last error) chọn để bảng không cuộn ngang ở 1440px (đo ở Task 19 của plan 2026-10-05); chuỗi đầy đủ vẫn ở `title`.`

Run: `pnpm --filter @tourism/admin exec vitest run src/components/outbox --maxWorkers=4`
Expected: PASS (class không bị spec nào khoá; nếu có, cập nhật theo số mới).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/subscribers/subscribers-table.tsx apps/admin/src/components/subscribers/subscribers-table.spec.tsx apps/admin/src/components/outbox/outbox-table.tsx
git commit -m "fix(admin): nút Export của Subscribers hết đè cột, bảng Outbox hết cuộn ngang"
```

---

### Task 16: Chi tiết booking và ngày chuyến

**Files:**

- Modify: `apps/admin/src/lib/bookings-view.ts` (`formatTripDates`) và spec
- Modify: `apps/admin/src/lib/cancellation-history.ts:25,64-73` và spec
- Create: `apps/admin/src/components/kit/email-text.tsx`, `email-text.spec.tsx`
- Modify: `apps/admin/src/components/bookings/booking-detail-sections.tsx:82,98,111,155-158`
- Modify: `apps/admin/src/lib/departures-view.ts:133`, `lib/departures-write.ts:344`,
  `components/departures/departure-row-actions.tsx:204,244`

**Interfaces:**

- Produces: `formatTripDates(start: string, end: string): string`; `EmailText({ email })`

- [ ] **Step 1: Spec (đỏ)**

`bookings-view.spec.ts` thêm:

```ts
describe('formatTripDates', () => {
  it('chuyến một ngày in MỘT ngày', () => {
    expect(formatTripDates('2026-12-27', '2026-12-27')).toBe('27 Dec 2026');
  });

  it('chuyến nhiều ngày in khoảng như formatDateRange', () => {
    expect(formatTripDates('2026-09-14', '2026-09-20')).toBe('14 Sep 2026 – 20 Sep 2026');
  });
});
```

`cancellation-history.spec.ts`: ca `'REFUNDED nổi bật, …'` đổi thành:

```ts
  it('REFUNDED cùng màu badge "Cancelled" đầu trang; REQUESTED nhạt; DENIED viền trơn', () => {
    // Nhãn của REFUNDED là "Cancelled" — y chữ badge trạng thái booking CANCELLED ở đầu
    // trang, nên phải cùng màu (`destructive`), không xanh đậm như trước (spec 2026-10-05 §4 #8).
    expect(cancellationStatusBadgeVariant('REFUNDED')).toBe('destructive');
    expect(cancellationStatusBadgeVariant('REQUESTED')).toBe('secondary');
    expect(cancellationStatusBadgeVariant('DENIED')).toBe('outline');
  });
```

`kit/email-text.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmailText } from './email-text';

/** Email xuống dòng ở chỗ hợp lý (spec 2026-10-05 §4 #7). */
describe('EmailText', () => {
  it('chữ giữ nguyên, có một cơ hội xuống dòng ngay sau @', () => {
    const { container } = render(<EmailText email="linh.nguyen@gmail.com" />);
    expect(container.textContent).toBe('linh.nguyen@gmail.com');
    expect(container.innerHTML).toBe('linh.nguyen@<wbr>gmail.com');
  });

  it('chuỗi không có @ ở giữa thì in nguyên', () => {
    const { container } = render(<EmailText email="@nowhere" />);
    expect(container.innerHTML).toBe('@nowhere');
  });
});
```

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/bookings-view.spec.ts src/lib/cancellation-history.spec.ts src/components/kit/email-text.spec.tsx --maxWorkers=4`
Expected: FAIL.

- [ ] **Step 2: Code**

`bookings-view.ts`, sau `formatDateRange`:

```ts
/**
 * Ngày của MỘT chuyến (spec 2026-10-05 §4 #10): chuyến một ngày in một ngày — "27 Dec 2026 –
 * 27 Dec 2026" là thừa. Tách khỏi `formatDateRange`, vốn còn nuôi câu "between …" của bộ lọc
 * ngày (plan 2026-10-05, quyết định 4).
 */
export function formatTripDates(start: string, end: string): string {
  return start === end ? formatCalendarDate(start) : formatDateRange(start, end);
}
```

`cancellation-history.ts`: kiểu `CancellationBadgeVariant` thêm `'destructive'`; `case 'REFUNDED':
return 'destructive';`; sửa JSDoc của hàm: "REFUNDED cùng màu badge CANCELLED đầu trang (nhãn của
nó là 'Cancelled')".

`kit/email-text.tsx`:

```tsx
/**
 * Email kèm một cơ hội xuống dòng ngay sau `@` (spec 2026-10-05 §4 #7). `LabelValueRow` bọc
 * giá trị trong `wrap-anywhere` (chống phình cột), nên email dài bị bẻ giữa chữ
 * ("…@gmail.co" / "m"). `<wbr>` cho trình duyệt một chỗ ngắt ĐẸP để dùng trước; ngắt bất
 * kỳ của `wrap-anywhere` chỉ còn là lưới cuối cho phần quá dài.
 */
export function EmailText({ email }: { email: string }) {
  const at = email.lastIndexOf('@');
  if (at <= 0) return <>{email}</>;
  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}
```

`booking-detail-sections.tsx`:

- import `EmailText`, `formatTripDates` (thay `formatDateRange` trong import nếu không còn chỗ dùng).
- `DetailRow` nhận `value: React.ReactNode` (import `type * as React from 'react'` nếu thiếu) và
  giữ luật rỗng: `value={value === null || value === '' ? t.empty : value}`.
- Dòng email: `value={booking.contactEmail ? <EmailText email={booking.contactEmail} /> : null}`.
- Dòng ngày: `formatDateRange(…)` → `formatTripDates(…)`.
- Dòng provider: `value={messages.admin.paymentEvents.provider[booking.paymentProvider]}` (comment:
  `// Nhãn "Stripe"/"PayPal" — dùng lại map của vùng Payment events (spec 2026-10-05 §4 #9).`).

Ngày chuyến ở chỗ khác — đổi `formatDateRange` → `formatTripDates` (import từ `./bookings-view`
hoặc `@/lib/bookings-view`):

- `lib/departures-view.ts:133`
- `lib/departures-write.ts:344`
- `components/departures/departure-row-actions.tsx:204` và `:244`

KHÔNG đổi `bookings-table.tsx:275` và `reviews-table.tsx:285` — đó là câu của bộ lọc ngày.

Grep còn email nào khác trong panel chi tiết admin:
`grep -rn "contactEmail\|\.email\b" apps/admin/src/components --include=*.tsx | grep -v spec`.
Dòng nào đặt email vào `LabelValueRow`/`DetailRow` thì bọc bằng `EmailText` như trên.

Run lại lệnh Step 1, rồi
`pnpm --filter @tourism/admin exec vitest run src/lib src/components/bookings src/components/departures --maxWorkers=4`.
Expected: PASS (spec departures nào in ngày một ngày thì cập nhật kỳ vọng).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/bookings-view.ts apps/admin/src/lib/bookings-view.spec.ts apps/admin/src/lib/cancellation-history.ts apps/admin/src/lib/cancellation-history.spec.ts apps/admin/src/components/kit/email-text.tsx apps/admin/src/components/kit/email-text.spec.tsx apps/admin/src/components/bookings/booking-detail-sections.tsx apps/admin/src/lib/departures-view.ts apps/admin/src/lib/departures-write.ts apps/admin/src/components/departures/departure-row-actions.tsx
git commit -m "fix(admin): chi tiết booking in email, provider, badge huỷ và ngày chuyến cho gọn"
```

(Thêm spec đã sửa vào `git add`.)

---

### Task 17: Biểu đồ doanh thu, lưới thẻ số liệu, đầu trang hai bảng catalog

**Files:**

- Modify: `apps/admin/src/components/chart-area-interactive.tsx:186`
- Modify: `apps/admin/src/components/kit/stat-card.tsx:62-66` và spec
- Modify: `apps/admin/src/app/(admin)/categories/page.tsx`, `destinations/page.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (bỏ `list.heading` nếu không còn chỗ dùng)

- [ ] **Step 1: Spec lưới (đỏ)**

Thêm vào `describe('StatCardRow')` của `stat-card.spec.tsx`:

```tsx
  it('màn hẹp xếp 2 cột; hàng chỉ một thẻ thì 1 cột', () => {
    const { rerender } = render(
      <StatCardRow
        cards={[
          { key: 'revenue', ...BASE },
          { key: 'paid', ...BASE, label: 'Paid bookings' },
          { key: 'pending', ...BASE, label: 'Pending' },
          { key: 'cancelled', ...BASE, label: 'Cancelled' },
        ]}
      />,
    );
    const region = screen.getByRole('region', { name: messages.admin.stats.regionLabel });
    expect(region.querySelector('.grid')).toHaveClass('grid-cols-2');

    rerender(<StatCardRow cards={[{ key: 'revenue', ...BASE }]} />);
    expect(region.querySelector('.grid')).toHaveClass('grid-cols-1');
  });
```

Run: `pnpm --filter @tourism/admin exec vitest run src/components/kit/stat-card.spec.tsx --maxWorkers=4`
Expected: FAIL.

- [ ] **Step 2: Lưới 2 cột**

`stat-card.tsx`, chuỗi class của lưới: bỏ `grid-cols-1` và `@xl/main:grid-cols-2` khỏi chuỗi đầu,
thêm một mục trong `cn(...)`:

```ts
        // Màn hẹp 2 cột (spec 2026-10-05 §4 #12): bốn thẻ xếp dọc từng chiếm hết màn đầu
        // tiên. Hàng chỉ một thẻ thì giữ 1 cột — nửa bề rộng trơ trọi.
        cards.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
```

Run lại lệnh Step 1. Expected: PASS.

- [ ] **Step 3: Biểu đồ**

`chart-area-interactive.tsx:186`: `type="natural"` → `type="monotone"`, kèm comment phía trên
`<Area>`: `{/* `monotone` không vọt quá điểm dữ liệu: `natural` uốn đường xuống dưới 0 ở ngày
không có doanh thu, trông như doanh thu âm (spec 2026-10-05 §4 #5). */}`. Đổi cấu hình vẽ, không
có test đơn vị — kiểm bằng mắt ở Task 19.

- [ ] **Step 4: Đầu trang Categories và Destinations**

Trong hai `page.tsx`, thay khối

```tsx
      <div className="flex flex-col gap-1 px-4 lg:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">{t.list.heading}</h2>
        <p className="text-sm text-muted-foreground">{t.list.subtitle}</p>
      </div>
```

bằng

```tsx
      {/* Không còn tiêu đề lớn: thanh tiêu đề của shell đã gọi tên trang, như mọi vùng khác
          (spec 2026-10-05 §4 #11). Câu giải thích giữ lại, thành dòng mờ. */}
      <p className="px-4 text-sm text-muted-foreground lg:px-6">{t.list.subtitle}</p>
```

Rồi `grep -rn "list.heading" apps/admin/src` — nếu không còn chỗ dùng, xoá `heading:` khỏi khối
`admin.categories.list` và `admin.destinations.list` của i18n và build lại i18n.

Run: `pnpm --filter @tourism/admin typecheck`
Expected: sạch.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/chart-area-interactive.tsx apps/admin/src/components/kit/stat-card.tsx apps/admin/src/components/kit/stat-card.spec.tsx "apps/admin/src/app/(admin)/categories/page.tsx" "apps/admin/src/app/(admin)/destinations/page.tsx" libs/shared/i18n/src/lib/messages.ts
git commit -m "fix(admin): đường doanh thu hết vọt dưới 0, thẻ số liệu 2 cột ở màn hẹp, đầu trang catalog đồng nhất"
```

---

### Task 18: Doc đi kèm

**Files:**

- Modify: `docs/specs/2026-09-22-p4e-2-categories-destinations-design.md` (§2a)
- Modify: `docs/specs/2026-10-02-p4f-users-staff-design.md`
- Modify: `docs/plans/2026-10-02-p4f-users-staff.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Spec P4e-2 §2a**

Cuối mục `### 2a. Chỉ bật/tắt, không xoá`, thêm một đoạn:

```markdown
> **Đã thay 05/10/2026:** [ADR-0053](../adr/0053-delete-unused-categories-destinations.md)
> cho xoá danh mục và điểm đến khi chưa tour nào dùng (mọi trạng thái). Ẩn vẫn là đường đảo
> ngược được cho hàng đang có tour.
```

- [ ] **Step 2: Doc P4f**

Đếm thực tế trước khi sửa:

```bash
grep -r "@Implement(contract.admin" apps/api/src | wc -l
grep -rl "@Implement(contract.admin" apps/api/src | wc -l
```

Expected: **58** lệnh trong **13** file (56 cũ cộng hai lệnh xoá). Khác số này thì dùng số thật.

Spec P4f (`docs/specs/2026-10-02-p4f-users-staff-design.md`):

- Bảng phân quyền: hàng `categories` cột "Chỉ Owner" điền `delete`; hàng `destinations` cột "Chỉ
  Owner" điền `delete`.
- `Tổng: 48 thủ tục Staff, 14 thủ tục chỉ Owner.` → `Tổng: 48 thủ tục Staff, 16 thủ tục chỉ Owner.`
- `đủ 62 khoá` → `đủ 64 khoá`.
- Thêm một dòng dưới bảng: `Hai lệnh xoá danh mục và điểm đến thêm 05/10 (ADR-0053), tầng Owner
  cùng họ \`tours.delete\`, \`posts.delete\`.`

Plan P4f (`docs/plans/2026-10-02-p4f-users-staff.md`) — sửa đúng các chỗ sau (grep
`grep -n "14 thủ tục\|62 \|\*\*56\*\*\|tổng 56\|OWNER_ONLY\|'tours.delete': 'owner'" docs/plans/2026-10-02-p4f-users-staff.md`):

- dòng 8: "trừ 14 thủ tục" → "trừ 16 thủ tục"
- dòng 13 và dòng 6315: "62" → "64"
- dòng 42–43: "**56** (49 thủ tục cũ và 7 của bài viết)" → "**58** (51 thủ tục cũ — gồm hai lệnh
  xoá danh mục/điểm đến của ADR-0053 — và 7 của bài viết)"
- mảng `OWNER_ONLY` (quanh dòng 713): thêm `'categories.delete',` và `'destinations.delete',` theo
  thứ tự chữ cái của mảng
- ca `'đúng 14 thủ tục là của riêng Owner'` (dòng 731) và các comment ở dòng 893, 4530, 5172:
  "14" → "16"
- bảng `ADMIN_ACCESS` trong code của plan (quanh dòng 843–863): thêm
  `'categories.delete': 'owner',` và `'destinations.delete': 'owner',` cạnh các khoá
  `categories.*`, `destinations.*`
- dòng 1480: "# tổng 56" → "# tổng 58"

Sau khi sửa: `git diff docs/plans/2026-10-02-p4f-users-staff.md docs/specs/2026-10-02-p4f-users-staff-design.md`
— kiểm không có dòng nào bắt đầu bằng `+` trong nội dung (ngoài dấu của diff), không đổi gì ngoài
các số trên.

- [ ] **Step 3: Bản đồ `docs/README.md`**

Thêm ADR-0053, spec và plan này vào đúng mục ADR, Specs, Plans của bản đồ, theo đúng khuôn dòng
của các mục hàng xóm (ví dụ ADR-0051, spec P4e-4, plan P4e-4).

- [ ] **Step 4: Commit**

```bash
git diff docs/
git add docs/specs/2026-09-22-p4e-2-categories-destinations-design.md docs/specs/2026-10-02-p4f-users-staff-design.md docs/plans/2026-10-02-p4f-users-staff.md docs/README.md
git commit -m "docs: trỏ spec P4e-2 sang ADR-0053, cộng hai lệnh xoá vào bảng quyền P4f"
```

---

### Task 19: Cổng cuối, đo giao diện, CHANGELOG

- [ ] **Step 1: `gate:int` có hãm tài nguyên**

Theo nếp đã dùng ở P4e-4 (Git Bash, từ gốc repo):

1. Bật API dev ở cổng 3001 cho build web (`cd apps/api && pnpm build && node --env-file-if-exists=.env.local dist/main.js`, chạy nền).
2. `pnpm turbo run build --concurrency=1`
3. `pnpm turbo run typecheck --concurrency=3`
4. `pnpm turbo run test --concurrency=1 -- --maxWorkers=4`
5. `pnpm lint && node scripts/check-mobile-tokens-only.mjs`
6. `pnpm test:int --concurrency=2`
7. Tắt API ở cổng 3001.

Expected: tất cả xanh. Đỏ ở đâu thì sửa tận gốc rồi chạy lại từ bước đỏ.

- [ ] **Step 2: Đo giao diện ở máy**

Dựng admin dev (API 3001, admin 3002) với DB Docker đã seed, đăng nhập bằng tài khoản admin của
seed, mở bằng built-in browser:

- `/outbox` ở 1440px: `document.querySelector('[data-slot="table-container"]')` (hoặc khung
  cuộn của bảng) có `scrollWidth <= clientWidth`. Còn cuộn thì hạ tiếp `max-w` của Last error.
- Dashboard: đường doanh thu không xuống dưới trục 0.
- 375px: Dashboard và Bookings xếp thẻ 2 cột, không tràn ngang.
- Khu sửa tour: ô Category, Difficulty, Destination thả danh sách xuống dưới, danh mục ẩn có
  "Hidden" mờ.
- Quick Create: bốn mục mở đúng hộp; F5 không mở lại.

- [ ] **Step 3: CHANGELOG**

Thêm entry đầu `docs/CHANGELOG.md` theo khuôn entry nhánh P4e-4: ngày, các hash, nội dung ba khối,
số test (unit, int), mục CÒN TREO (thử tay prod 8 bước của spec §5; xoá điểm đến `abc` bằng nút
mới). Không để `+` ở đầu dòng; `git diff docs/CHANGELOG.md` trước khi stage.

```bash
git add docs/CHANGELOG.md
git commit -m "docs: ghi CHANGELOG đợt sửa sạn giao diện admin"
```

- [ ] **Step 4: Dừng, báo user**

Báo kết quả gate, số test, các đo đạc ở Step 2; hỏi user trước khi rebase lên `main`, merge
`--ff-only` và push (luật 2). Không migration nào phải chạy lên Supabase.
