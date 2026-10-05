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
