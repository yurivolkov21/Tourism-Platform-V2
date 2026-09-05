/**
 * Số đo dùng chung của hàng điều khiển bảng admin.
 *
 * Mốc là dải lọc trạng thái kiểu `toggle-group-01`: đệm `p-1` bọc item, và
 * tổng của hai thứ ấy là chiều cao mà MỌI control trên hàng phải bằng (user
 * chốt 01/09: "các thanh, các nút cho cùng kích cỡ với toggle group").
 *
 * **36px kể từ 05/09** (trước là 44px — user chốt qua bản demo
 * `docs/design/mockups/admin-toolbar-sizing.src.html`). Hạ CẢ HAI vế cùng lúc
 * là bắt buộc: hạ riêng các nút thì chúng thấp hơn dải tab và phá đúng cái
 * căn hàng mà chốt 01/09 dựng ra.
 *
 * Cách hạ dải tab cũng đã cân: giữ đệm `p-1` và hạ viên pill xuống `h-7`, chứ
 * KHÔNG bóp đệm về `p-0.5` mà giữ pill `h-8`. Hai cách cùng ra 36px nhưng ở
 * cách sau khung mất 18% chiều cao còn pill chỉ mất 11% — pill hoá ra chiếm
 * 89% khung thay vì 82% như bản 44px, và dải tab trông đặc lại (user phát
 * hiện trên bản demo lượt 1).
 *
 * `cn` của repo chạy qua `twMerge`, nên class truyền vào className LUÔN thắng
 * class mặc định của variant — kể cả class có tiền tố biến thể như
 * `data-[size=default]:h-8`, miễn là ta ghi lại đúng tiền tố ấy.
 */

/** Ô nhập (tìm kiếm, ngày). `Input` mặc định `h-8`. */
export const TOOLBAR_FIELD = 'h-9';

/**
 * Nút chữ (Clear filters, Export). Ở 36px con số này TRÙNG với `size="lg"`
 * sẵn có của `Button` (`h-9`) — nhưng vẫn khai tường minh chứ không đổi sang
 * prop `size`: mọi call site đang truyền `className`, và đổi hết sang `size`
 * là sửa bảy file để đạt đúng cùng một pixel.
 */
export const TOOLBAR_BUTTON = 'h-9 px-3';

/**
 * Ô Select thay dải nút ở màn hẹp. Chiều cao của nó nằm sau selector thuộc
 * tính (`data-[size=default]:h-8`) nên `h-9` trần KHÔNG đè nổi — phải viết
 * lại đúng tiền tố ấy thì twMerge mới nhận ra là cùng một chỗ.
 */
export const TOOLBAR_SELECT = 'data-[size=default]:h-9';
