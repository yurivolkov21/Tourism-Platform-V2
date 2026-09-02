import type { Paged } from '@tourism/contract';

/**
 * Bọc một trang kết quả admin thành `Paged<T>` của contract — MỘT bản cho
 * mọi list admin (vòng vá review F7: bookings/cancellations/outbox từng chép
 * khối `{ items, page, limit, total, totalPages: Math.ceil(...) }` tay).
 *
 * `totalPages` là `Math.ceil(total / limit)` — tập rỗng cho `0` trang, và
 * `TablePagination` phía admin tự kẹp `shownPage/lastPage` về ≥ 1 khi vẽ.
 * (`reviews.service` còn giữ `Math.max(1, …)` của riêng nó — cùng kết quả
 * hiển thị, khác số thô; đổi nó là đổi contract test đã pin, để P4d dọn.)
 */
export function toPaged<T>(
  items: T[],
  paging: { page: number; limit: number; total: number },
): Paged<T> {
  const { page, limit, total } = paging;
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}
