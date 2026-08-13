/**
 * Lớp bù cho `.btn-sm` của wireframe — dùng ở tab Departures, tab Reviews và
 * modal review.
 *
 * Bản duyệt định nghĩa `.btn-sm` là **cao 32, đệm ngang 14, chữ 13, bo
 * `--radius-sm`**. `size="sm"` của `Button` KHÔNG phải cái đó: nó cao 28, chữ
 * 12.8 và bo `min(--radius-md,12px)` — đo được lệch 4px chiều cao ở mọi nút nhỏ
 * của hai tab. `size="default"` cho đúng 32 nhưng đệm 10 và chữ 14, nên ba con
 * số còn lại vẫn phải đè.
 *
 * Giữ ở một hằng số thay vì chép sáu lần: sáu bản chép sẽ lệch nhau ở lần sửa
 * thứ hai, và nút "Select" trong bảng đợt phải cao đúng bằng nút "See all dates"
 * ngay phía trên nó.
 */
export const PANEL_BTN_SM = 'h-8 rounded-sm px-3.5 text-[13px]';
