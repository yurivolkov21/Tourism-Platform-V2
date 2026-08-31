import { columnVisibilityFeature, tableFeatures } from '@tanstack/react-table';

/**
 * Bộ feature TanStack v9 cho bảng admin ĐỌC TỪ SERVER (spec P4b §2.2).
 *
 * Chỉ đăng ký ĐÚNG MỘT feature — phần còn lại bị tree-shake:
 * - `columnVisibilityFeature`: menu ẩn/hiện cột, thuần client, giữ từ kit
 *   dashboard-01.
 *
 * CỐ Ý KHÔNG có pagination lẫn row model filtered/sorted: trạng thái trang
 * sống TRÊN URL và `TablePagination` nhận thẳng props từ server component —
 * bản F1 đầu từng đăng ký `rowPaginationFeature` + `manualPagination` nhưng
 * không một API phân trang nào của table được đọc, thành state controlled
 * chết không handler (review 31/08 gỡ). Lọc/sắp xếp/cắt trang là việc của
 * API — row model client chỉ nhìn thấy đúng một trang nên mọi phép nó làm
 * đều sai phạm vi.
 */
export const serverTableFeatures = tableFeatures({
  columnVisibilityFeature,
});
