import { messages } from '@tourism/i18n';
import type * as React from 'react';
import { MENU_HINT } from '@/components/kit/menu-style';

/**
 * MỘT lựa chọn của dropdown admin — kiểu dữ liệu, tên đọc-màn-hình và cách vẽ dùng chung cho ô
 * `Picker` (Select) lẫn menu lọc `ToolbarFilterMenu` (Menu), ở cả danh sách lẫn ô/nút đang hiện
 * giá trị (review RU3/SI4). Trước đây ba nơi tự vẽ và đã trôi khỏi nhau: Picker cắt "…" còn
 * menu xuống dòng; trình đọc màn hình nghe "Retired Hidden" ở danh sách nhưng "Retired
 * (Hidden)" ở nút menu. Muốn đổi dáng hay cách đọc thì đổi Ở ĐÂY.
 */
export interface DropdownOption {
  /** Giá trị THÔ đi thẳng ra `onValueChange`/`onSelect` — kit không giải mã tiền tố hộ vùng. */
  value: string;
  label: string;
  /**
   * Icon đầu dòng; mục đang chọn có icon thì ô/nút cũng hiện nó. TUỲ CHỌN vì `/subscribers` lọc
   * theo chuỗi tự do từ DB: không biết trước giá trị thì không có icon nào để khai.
   */
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Chữ phụ mờ sau tên (vd "Hidden" cho mục đã ẩn) — thay cho kiểu ghép "(hidden)" vào tên. */
  hint?: string;
}

/**
 * Tên đọc-màn-hình của một lựa chọn: "Retired (Hidden)" khi có chữ phụ, không thì đúng tên. Mọi
 * nơi nói tên mục cho trình đọc màn hình đều qua hàm này — danh sách, ô, nút menu, radio.
 */
export function optionName(option: Pick<DropdownOption, 'label' | 'hint'>): string {
  return option.hint ? messages.admin.option.withHint(option.label, option.hint) : option.label;
}

/**
 * Icon, tên và chữ phụ của một lựa chọn. Tên `truncate`: dài thì cắt "…", ở Picker hay menu như
 * nhau; chữ phụ `MENU_HINT` (`shrink-0`) không bao giờ bị cắt — mất nó là mất điều duy nhất nói
 * mục đã ẩn. Có chữ phụ thì phần nhìn thấy rời cây trợ năng, thay bằng MỘT câu `optionName`.
 *
 * Icon mang `data-icon="inline-start"`: nút `Button` của menu lọc đọc nó để nới đệm trái; danh
 * sách và ô Select không có luật nào cho thuộc tính này. KHÔNG đắp `size-*`: mục Select/Menu, ô
 * Select và `Button` đều sẵn `[&_svg:not([class*='size-'])]:size-4`, tự chúng lo cỡ.
 */
export function OptionContent({ option }: { option: DropdownOption }) {
  const Icon = option.icon;
  return (
    <>
      {Icon ? <Icon aria-hidden="true" data-icon="inline-start" /> : null}
      {option.hint ? (
        <>
          <span aria-hidden="true" className="truncate">
            {option.label}
          </span>
          <span aria-hidden="true" className={MENU_HINT}>
            {option.hint}
          </span>
          <span className="sr-only">{optionName(option)}</span>
        </>
      ) : (
        <span className="truncate">{option.label}</span>
      )}
    </>
  );
}
