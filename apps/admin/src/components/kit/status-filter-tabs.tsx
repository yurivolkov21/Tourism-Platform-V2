'use client';

import { ToggleGroup, ToggleGroupItem } from '@tourism/ui/components/toggle-group';
import { motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { ToolbarSelect } from '@/components/kit/toolbar-select';

/**
 * Bộ lọc trạng thái của bảng admin (kit P4b — nâng từ cặp bản chép
 * bookings-toolbar/cancellations-toolbar ở review F3 31/08): cặp "dải nút ở
 * màn rộng · Select ở màn hẹp" (`@4xl/main`) đúng khuôn block dashboard-01,
 * để mọi bảng vùng nhìn là một hệ (user chốt 31/08).
 *
 * Dải nút lấy từ `toggle-group-01` của Shadcn Space (user chốt 01/09): viên
 * pill nền `primary` TRƯỢT từ mục cũ sang mục mới bằng shared-layout của
 * Motion, thay cho bản `TabsList` đổi màu đứng im trước đó. Registry khai ở
 * `components.json` (`@shadcn-space`), kéo lại bản gốc bằng
 * `pnpm dlx shadcn@latest view @shadcn-space/toggle-group-01`.
 *
 * Tên "Tabs" giữ nguyên dù primitive bên dưới nay là `ToggleGroup`: nó tả
 * HÌNH DẠNG (một dải lựa chọn liền khối) chứ không tả primitive, và đổi tên
 * là chạm vào ba toolbar vùng cho một thứ không đổi hành vi.
 *
 * Component chỉ làm MỘT việc: báo `onSelect(value)` — vùng tự quyết đổi URL
 * thế nào (safeParse enum, dựng href). Giá trị "tất cả" cũng do vùng đặt
 * (Select/ToggleGroup cần một value thật, URL thì bỏ trống).
 */
/**
 * Giá trị tab "tất cả" — hợp đồng riêng với component này (Select/ToggleGroup
 * cần một value thật, URL thì bỏ trống). Ở KIT chứ không ở từng toolbar: ba
 * vùng từng chép tay `'ALL'`, vùng thứ tư gõ `'all'` là filter chọn nhầm im
 * lặng (review F4 31/08). Chữ HOA để không đụng member enum contract nào.
 */
export const ALL_FILTER_VALUE = 'ALL';

/**
 * Lò xo của viên pill, bê nguyên số từ bản registry — đủ nhanh để theo kịp
 * cú bấm, đủ mềm để mắt bắt được nó ĐI TỪ ĐÂU SANG ĐÂU (đó mới là việc của
 * chuyển động này: nối mục cũ với mục mới, không phải trang trí).
 */
const PILL_SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const;

export interface StatusFilterItem {
  label: string;
  value: string;
  /**
   * Icon đi kèm nhãn (user chốt 01/09, theo bản registry). Vùng tự chọn chứ
   * không phải kit: "icon nào cho trạng thái nào" là kiến thức nghiệp vụ của
   * từng bảng, kit không biết REFUNDED khác PARTIALLY_REFUNDED ở đâu.
   *
   * Truyền component chứ không truyền tên: tên là một lớp tra cứu thừa, và
   * gõ sai tên thì im lặng mất icon thay vì đỏ ở typecheck.
   */
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
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
  /** Nhãn cho cả cụm (sr-only trên Select, aria-label trên dải nút). */
  label: string;
  /** `id` của SelectTrigger — mỗi bảng một id, tránh trùng khi hai bảng cùng DOM. */
  selectId: string;
  onSelect: (value: string) => void;
}) {
  const reduced = useReducedMotion();

  return (
    <>
      {/* Màn hẹp: select gọn — cùng cặp @4xl/main của block dashboard-01;
          chính kit `ToolbarSelect` (vòng vá review F7, hết bản chép). */}
      <ToolbarSelect
        id={selectId}
        label={label}
        value={value}
        items={items}
        onSelect={onSelect}
        className="flex @4xl/main:hidden"
      />

      {/* Ẩn/hiện đặt ở ROOT chứ không ở trong: root là con trực tiếp của hàng
          `justify-between`, để nó luôn hiện thì màn hẹp có một khối rỗng chen
          giữa select và cụm hành động. */}
      <ToggleGroup
        value={[value]}
        // `multiple` mặc định false, nên bấm lại chính mục đang chọn sẽ THẢ nó
        // ra và trả về mảng rỗng. Bộ lọc thì luôn phải có đúng một mục (kể cả
        // "All"), nên mảng rỗng bị bỏ qua — cùng cách bản registry chặn.
        onValueChange={(next) => {
          const [first] = next;
          if (first) onSelect(first);
        }}
        aria-label={label}
        spacing={0}
        // Đúng số đo bản registry: `p-1` + item `h-9` = 44px (user chốt xem
        // bản thoáng 01/09). Nó cao hơn ô tìm kiếm `h-8` 12px nên là thứ cao
        // nhất hàng điều khiển — hàng `items-center` nên vẫn canh giữa, chỉ
        // là cả hàng dày lên theo.
        className="hidden gap-1 rounded-xl border bg-muted/40 p-1 @4xl/main:flex"
      >
        {items.map((item) => {
          const isActive = item.value === value;

          return (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              // `aria-pressed:bg-transparent!` để nền mục đang chọn nhường
              // hẳn cho viên pill bên dưới — `toggleVariants` của repo mặc
              // định tô `aria-pressed:bg-muted`, để nguyên thì có HAI lớp nền
              // và viên pill trượt trên một vệt xám đứng im.
              className="relative h-9 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground aria-pressed:bg-transparent! aria-pressed:text-primary-foreground!"
            >
              {/* `<span>` chứ không phải `<div>` như bản registry: cái này nằm
                  TRONG `<button>`, mà button chỉ chứa được phrasing content. */}
              <span className="relative z-10 flex items-center gap-2">
                {/* KHÔNG đắp `size-4`: `toggleVariants` đã sẵn
                    `[&_svg:not([class*='size-'])]:size-4`, tự nó lo cỡ icon —
                    đắp tay là giành việc của component và là chỗ để hai cỡ
                    icon mọc ra sau này. */}
                {item.icon ? <item.icon aria-hidden="true" /> : null}
                {item.label}
              </span>
              {isActive ? (
                <motion.span
                  // `layoutId` theo `selectId` chứ không phải một hằng chung:
                  // hai bảng cùng một trang mà trùng id thì Motion coi hai
                  // viên pill là MỘT và bắn nó bay qua lại giữa hai bảng.
                  layoutId={`${selectId}-active-pill`}
                  className="absolute inset-0 z-0 rounded-lg bg-primary"
                  // Tôn trọng prefers-reduced-motion: vẫn đổi chỗ, nhưng
                  // không trượt (nếp `tilt-card` bên web).
                  transition={reduced ? { duration: 0 } : PILL_SPRING}
                />
              ) : null}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </>
  );
}
