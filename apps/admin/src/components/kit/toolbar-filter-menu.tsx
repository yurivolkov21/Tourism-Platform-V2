'use client';

import { Button } from '@tourism/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';

/**
 * Menu lọc của hàng điều khiển bảng admin — khuôn `dropdown-menu-10` của
 * Shadcn Studio (user chốt 03/09): `align="end"`, rộng `w-66`,
 * `DropdownMenuSeparator` chia nhóm, mỗi mục một icon.
 *
 * Ở KIT chứ không ở từng vùng vì có BỐN consumer thật — vượt ngưỡng ≥2 của
 * luật kit (spec P4c §2.6), và vì user chốt 31/08 "muốn đổi dáng thì đổi ở
 * kit để các vùng cùng đổi". Đợt 1 (03/09) dựng bản đầu nằm trong
 * `components/outbox/`; đợt 2 cùng ngày, khi `/payment-events` và
 * `/subscribers` dùng cùng hình dạng, nó lên đây và ba vùng tiêu thụ lại —
 * đúng đường mà `ToolbarSelect` đã đi ở vòng vá review F7. Đợt 3 thêm ô tháng
 * `/reports`, và chính nó buộc `allItem` phải nới thành tuỳ chọn.
 *
 * KHÔNG thay `ToolbarSelect`: hai nơi còn lại của Select (nhánh mobile của
 * `StatusFilterTabs`, ô đổi trạng thái `/enquiries`) là danh sách phẳng ngắn,
 * và ô `/enquiries` là control GHI chứ không phải lọc. Hai control cùng sống,
 * mỗi cái một việc.
 *
 * BA CHỖ bản registry không lo hộ, vá ở đây một lần cho cả ba vùng:
 *
 * 1. dm-10 dùng `DropdownMenuItem` trơn — không có trạng thái chọn. Đây là bộ
 *    LỌC nên phải `RadioGroup`: chép y nguyên là mất dấu hiệu "đang lọc cái
 *    nào", thứ một Select vốn hiển nhiên có.
 * 2. `MenuRadioItem` của Base UI mặc định `closeOnClick = false` (hợp cho menu
 *    bấm nhiều lần như menu Columns). Ở đây chọn xong là ĐIỀU HƯỚNG, nên phải
 *    bật tường minh — không thì menu treo lại trên trang vừa mở.
 * 3. Base UI phát `any` cho `onValueChange`, và phát `null` khi item bị gỡ
 *    giữa chừng — cùng cái bẫy `ToolbarSelect` đã chặn.
 *
 * Khe `DropdownMenuShortcut` của dm-10 CỐ Ý bỏ trống: thứ đáng nằm ở đó là số
 * hàng theo từng mục, mà không endpoint stats nào của admin trả về con số ấy —
 * thêm nó là sửa `apps/api` + contract.
 */
export interface ToolbarFilterMenuItem {
  /** Value THÔ đi thẳng vào `onSelect` — kit không giải mã tiền tố hộ vùng. */
  value: string;
  label: string;
  /**
   * Icon đầu dòng. TUỲ CHỌN vì `/subscribers` lọc theo chuỗi tự do từ DB:
   * không biết trước giá trị thì không có icon nào để khai.
   */
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export interface ToolbarFilterMenuGroup {
  /** Khoá React của nhóm — tên họ, KHÔNG phải chỉ số mảng. */
  key: string;
  items: ToolbarFilterMenuItem[];
}

export function ToolbarFilterMenu({
  label,
  value,
  allItem,
  groups,
  onSelect,
}: {
  /**
   * Mục đích của bộ lọc ("Filter by email type"). Vào HAI chỗ: tên đọc-màn-
   * hình của nút (nút hiện giá trị nên tự nó không nói ra mục đích) và nhãn
   * nhóm trong menu.
   */
  label: string;
  /** Value đang lọc — sentinel "tất cả" hoặc value của một mục. */
  value: string;
  /**
   * Mục "tất cả": luôn đứng đầu, TRÊN separator đầu tiên. TUỲ CHỌN vì không
   * phải bộ lọc nào cũng có trạng thái "tất cả" — ô tháng của `/reports` luôn
   * có đúng một tháng, bày thêm "mọi tháng" là mời bấm vào một báo cáo không
   * tồn tại.
   */
  allItem?: ToolbarFilterMenuItem;
  /** Các nhóm, mỗi nhóm cách nhau một separator. Một nhóm cũng hợp lệ. */
  groups: readonly ToolbarFilterMenuGroup[];
  /** Nhận chuỗi THÔ; vùng tự `safeParse` hoặc giải tiền tố rồi đổi URL. */
  onSelect: (value: string) => void;
}) {
  /**
   * Mục đang lọc quyết định cả chữ lẫn icon trên nút. Không tìm thấy thì rơi
   * về mục "tất cả" — vừa là ca chưa lọc, vừa là lưới an toàn cho ca vùng
   * quên bơm mục tạm cho một giá trị lạ gõ tay trên URL (bài học review F10:
   * nút nói "All" trong khi bảng đang lọc thật là nói dối).
   */
  const current = groups.flatMap((group) => group.items).find((item) => item.value === value);
  const shown = current ?? allItem;
  const CurrentIcon = shown?.icon;
  // Không mục nào khớp VÀ không có mục "tất cả": in thẳng value. Thà hiện
  // `2026-99` còn hơn mượn nhãn của mục khác — nút phải đọc ra được thứ đang
  // nằm trên URL.
  const shownLabel = shown?.label ?? value;

  function handleChange(next: unknown) {
    if (next === null || next === undefined) return;
    onSelect(String(next));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={TOOLBAR_BUTTON}
            aria-label={`${label}: ${shownLabel}`}
          />
        }
      >
        {CurrentIcon ? <CurrentIcon data-icon="inline-start" /> : null}
        {shownLabel}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      {/* `w-66` (264px) của dm-10 thay cho `w-fit` của Select cũ: nhãn dài
          vừa một dòng, và menu không co giãn theo mục đang chọn. */}
      <DropdownMenuContent align="end" className="w-66">
        {/* `DropdownMenuLabel` render ra `MenuPrimitive.GroupLabel`, cần một
            group thật để gắn nhãn vào — `RadioGroup` CÓ cung cấp context ấy
            (nó bọc `MenuGroupContext.Provider` rồi đọc id lại vào
            `aria-labelledby`), nên không cần lồng thêm `DropdownMenuGroup`. */}
        <DropdownMenuRadioGroup value={value} onValueChange={handleChange}>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {allItem ? <FilterMenuItem item={allItem} /> : null}
          {groups.map((group, index) => (
            <React.Fragment key={group.key}>
              {/* Không có mục "tất cả" thì nhóm đầu tiên KHÔNG cần separator:
                  nó nằm ngay dưới nhãn, ngăn thêm một vạch là vạch thừa. */}
              {allItem || index > 0 ? <DropdownMenuSeparator /> : null}
              {group.items.map((item) => (
                <FilterMenuItem key={item.value} item={item} />
              ))}
            </React.Fragment>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterMenuItem({ item }: { item: ToolbarFilterMenuItem }) {
  const Icon = item.icon;

  return (
    <DropdownMenuRadioItem value={item.value} closeOnClick>
      {/* KHÔNG đắp `size-4`: item đã sẵn
          `[&_svg:not([class*='size-'])]:size-4`, tự nó lo cỡ. */}
      {Icon ? <Icon aria-hidden="true" /> : null}
      {item.label}
    </DropdownMenuRadioItem>
  );
}
