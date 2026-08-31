import {
  columnVisibilityFeature,
  rowPaginationFeature,
  tableFeatures,
} from '@tanstack/react-table';

/**
 * Bộ feature TanStack v9 cho bảng admin ĐỌC TỪ SERVER (spec P4b §2.2).
 *
 * Chỉ đăng ký hai feature — phần còn lại bị tree-shake:
 * - `columnVisibilityFeature`: menu ẩn/hiện cột, thuần client, giữ từ kit
 *   dashboard-01.
 * - `rowPaginationFeature`: chạy ở chế độ `manualPagination` — server đã cắt
 *   sẵn trang, table chỉ cần `rowCount` để tính `getPageCount()` và biết còn
 *   trang trước/sau hay không.
 *
 * CỐ Ý KHÔNG có row model filtered/sorted/paginated: lọc, sắp xếp và cắt
 * trang đều là việc của API — row model client chỉ nhìn thấy đúng một trang
 * nên mọi phép nó làm đều sai phạm vi (xem skill `client-vs-server` của
 * @tanstack/table-core).
 */
export const serverTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
});

export type ServerTableFeatures = typeof serverTableFeatures;
