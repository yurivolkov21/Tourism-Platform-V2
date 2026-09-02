/**
 * Số đo dùng chung của hàng điều khiển bảng admin (user chốt 01/09: "các
 * thanh, các nút cho cùng kích cỡ với toggle group").
 *
 * Mốc là dải lọc trạng thái kiểu `toggle-group-01`: `p-1` bọc item `h-9` =
 * **44px**. Không có size variant nào của `Button`/`SelectTrigger` cao tới đó
 * (`Button` dừng ở `lg` = h-9, `SelectTrigger` ở h-8), nên phải đắp class —
 * và đắp Ở ĐÂY chứ không rắc `h-11` khắp bốn file, vì đó đúng là cách hàng
 * điều khiển trôi mỗi nơi một kiểu.
 *
 * `cn` của repo chạy qua `twMerge`, nên class truyền vào className LUÔN thắng
 * class mặc định của variant — kể cả class có tiền tố biến thể như
 * `data-[size=default]:h-8`, miễn là ta ghi lại đúng tiền tố ấy.
 */

/** Ô nhập (tìm kiếm, ngày). `Input` mặc định `h-8`. */
export const TOOLBAR_FIELD = 'h-11';

/**
 * Nút chữ (Clear, Export CSV). Dùng kèm `size="default"`: `h-8 px-2.5` —
 * cao lên 44px thì đệm ngang `px-2.5` trông chật, nên nới cùng lúc.
 */
export const TOOLBAR_BUTTON = 'h-11 px-4';

/**
 * Ô Select thay dải nút ở màn hẹp. Chiều cao của nó nằm sau selector thuộc
 * tính (`data-[size=default]:h-8`) nên `h-11` trần KHÔNG đè nổi — phải viết
 * lại đúng tiền tố ấy thì twMerge mới nhận ra là cùng một chỗ.
 */
export const TOOLBAR_SELECT = 'data-[size=default]:h-11';
