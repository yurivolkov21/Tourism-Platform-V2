/** Một trang của `PagedSchema` — chỉ cần hai field này để đi hết danh sách. */
export interface PageLike<T> {
  items: T[];
  totalPages: number;
}

/**
 * Đi hết các trang của một danh sách phân trang (G10): đọc trang 1, rồi lần
 * lượt trang 2 tới `totalPages` của trang đầu, không vượt `maxPages`.
 *
 * - Gọi TUẦN TỰ chứ không song song: mỗi trang là một lượt gọi riêng vào API
 *   free của Render, dồn một loạt cùng lúc lúc build là tự chuốc 502.
 * - Bỏ phần tử trùng theo `key`, giữ lần đầu: thêm một tour giữa hai lượt gọi
 *   đẩy mọi tour lùi một bậc, tour cuối trang trước hiện lại ở trang sau.
 * - Không nuốt lỗi: một trang hỏng thì ném, nơi gọi tự quyết `settle` hay để
 *   build đỏ — đúng như khi chỉ gọi một trang.
 *
 * Trả kèm `totalPages` thật để nơi gọi biết danh sách có bị cắt ở trần không.
 */
export async function collectAllPages<T>(
  fetchPage: (page: number) => Promise<PageLike<T>>,
  options: { maxPages: number; key: (item: T) => string },
): Promise<{ items: T[]; totalPages: number }> {
  const first = await fetchPage(1);
  const lastPage = Math.min(first.totalPages, options.maxPages);

  const seen = new Set<string>();
  const items: T[] = [];
  const keep = (page: PageLike<T>) => {
    for (const item of page.items) {
      const id = options.key(item);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
  };

  keep(first);
  for (let page = 2; page <= lastPage; page += 1) {
    keep(await fetchPage(page));
  }
  return { items, totalPages: first.totalPages };
}
