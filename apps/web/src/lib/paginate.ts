/** Phong bì phân trang — gương đúng `PagedSchema` của contract để lúc gắn API
    swap thẳng. Đặt ở lib riêng (không phải lib/tours) vì /blog cũng dùng. */
export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Cắt một trang. `page` ngoài dải KHÔNG throw — trả trang rỗng, vì URL do
    người dùng gõ tay hoặc link cũ hoàn toàn có thể trỏ trang không tồn tại. */
export function paginate<T>(items: readonly T[], page: number, limit: number): Paged<T> {
  const total = items.length;
  // Danh sách rỗng cho totalPages = 0 (không phải 1): "0 trang" là sự thật,
  // và thanh phân trang dựa vào đó để tự ẩn.
  const totalPages = Math.ceil(total / limit);
  const current = Math.max(1, page);
  const start = (current - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    page: current,
    limit,
    total,
    totalPages,
  };
}

/** Dãy số trang có ellipsis. Luôn giữ trang đầu, trang cuối và 1 trang kề hai
    bên trang hiện tại — dải cố định nên thanh phân trang không nhảy chiều
    ngang khi bấm qua lại. */
export function pageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const result: (number | 'ellipsis')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(totalPages - 1, page + 1);

  if (from > 2) result.push('ellipsis');
  for (let i = from; i <= to; i++) result.push(i);
  if (to < totalPages - 1) result.push('ellipsis');

  result.push(totalPages);
  return result;
}
