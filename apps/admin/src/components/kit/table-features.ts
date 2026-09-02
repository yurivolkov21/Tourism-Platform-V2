import { columnVisibilityFeature, rowSelectionFeature, tableFeatures } from '@tanstack/react-table';

/**
 * Bộ feature TanStack v9 cho bảng admin ĐỌC TỪ SERVER (spec P4b §2.2).
 *
 * Luật: **đừng đăng ký thứ không ai đọc** — review 31/08 gỡ
 * `rowPaginationFeature` vì nó thành state controlled chết không handler. Vì
 * thế có HAI bộ, mỗi bảng lấy đúng bộ nó đọc:
 *
 * - `serverTableFeatures` — chỉ `columnVisibilityFeature` (menu ẩn/hiện cột,
 *   thuần client, giữ từ kit dashboard-01). Cho `/cancellations`, `/reviews`.
 * - `selectableTableFeatures` — cộng `rowSelectionFeature` cho bảng có cột
 *   checkbox (`/bookings`, 01/09: xuất CSV đúng các hàng đã tích). Cột đọc
 *   thật `getIsAllRowsSelected`, `getSelectedRowModel`, `toggleAllRowsSelected`
 *   và `toggleSelected` — bộ `…AllRows…` chứ KHÔNG phải `…AllPageRows…` (bộ
 *   "page" đọc row model PHÂN TRANG, mà ở đây không đăng ký
 *   `rowPaginationFeature` nên chúng im lặng không làm gì; lý do đầy đủ ở
 *   `bookings-table.tsx`).
 *
 * CỐ Ý vẫn KHÔNG có pagination lẫn row model filtered/sorted: trạng thái trang
 * sống TRÊN URL và `TablePagination` nhận thẳng props từ server component.
 * Lọc/sắp xếp/cắt trang là việc của API — row model client chỉ nhìn thấy đúng
 * một trang nên mọi phép nó làm đều sai phạm vi.
 *
 * Về vòng đời của state chọn hàng: đổi trang/lọc là soft navigation cùng
 * segment nên React GIỮ `useState` của bảng — state KHÔNG tự chết như bản đầu
 * 01/09 giả định (vòng vá review 02/09). Bảng phải tự ĐẶT LẠI nó khi query
 * đổi — xem `BookingsTable`.
 */
export const serverTableFeatures = tableFeatures({
  columnVisibilityFeature,
});

export const selectableTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
});
