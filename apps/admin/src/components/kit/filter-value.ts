import { ALL_FILTER_VALUE } from '@/components/kit/status-filter-tabs';

/**
 * Giao ước GIÁ TRỊ của mọi control lọc trong kit — một chỗ (vòng vá review
 * polish 2): sentinel "All" và phép đóng/mở giá trị TỰ DO từng nằm ở hai
 * module khác nhau (`status-filter-tabs`, `toolbar-select`) mà `ToolbarFilterMenu`
 * — nơi dùng chúng nhiều nhất — không sở hữu cái nào; vùng thứ năm đọc JSDoc
 * "value THÔ" rồi truyền thẳng chuỗi DB là lỗi F10 (`source = 'ALL'` thành nút
 * xoá filter) tái sinh.
 *
 * Tiền tố `v:` — mọi giá trị thật (chuỗi từ DB: `source`, `type`) đều đi qua
 * nó, nên `ALL_FILTER_VALUE` là chuỗi duy nhất KHÔNG mang tiền tố.
 */
export { ALL_FILTER_VALUE };

const FREE_VALUE_PREFIX = 'v:';

export function toFreeValue(value: string): string {
  return `${FREE_VALUE_PREFIX}${value}`;
}

/** Giá trị control → chuỗi thật; `null` khi là mục "All" (không có tiền tố). */
export function fromFreeValue(selected: string): string | null {
  return selected.startsWith(FREE_VALUE_PREFIX) ? selected.slice(FREE_VALUE_PREFIX.length) : null;
}
