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
