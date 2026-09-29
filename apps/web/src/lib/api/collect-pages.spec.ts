import { describe, expect, it, vi } from 'vitest';
import { collectAllPages } from './collect-pages';

/**
 * G10: web từng chỉ lấy trang 1 của danh sách tour, nên tour thứ 51 trở đi biến
 * khỏi listing, sitemap và prerender. `collectAllPages` đi hết các trang theo
 * `totalPages` của trang đầu. `fetchPage` được tiêm, spec không gọi API thật.
 */

type Item = { id: string };

/** Dựng `fetchPage` giả từ danh sách các trang; ghi lại trang nào đã được gọi. */
function pages(all: Item[][], totalPages = all.length) {
  const fetchPage = vi.fn(async (page: number) => ({
    items: all[page - 1] ?? [],
    totalPages,
  }));
  return fetchPage;
}

const ids = (items: Item[]) => items.map((item) => item.id);
const key = (item: Item) => item.id;

describe('collectAllPages', () => {
  it('một trang: gọi đúng một lần, trả nguyên danh sách', async () => {
    const fetchPage = pages([[{ id: 'a' }, { id: 'b' }]]);
    const out = await collectAllPages(fetchPage, { maxPages: 20, key });
    expect(ids(out.items)).toEqual(['a', 'b']);
    expect(out.totalPages).toBe(1);
    expect(fetchPage.mock.calls).toEqual([[1]]);
  });

  it('ba trang: gọi lần lượt 1, 2, 3 và nối đúng thứ tự', async () => {
    const fetchPage = pages([[{ id: 'a' }], [{ id: 'b' }], [{ id: 'c' }]]);
    const out = await collectAllPages(fetchPage, { maxPages: 20, key });
    expect(ids(out.items)).toEqual(['a', 'b', 'c']);
    expect(fetchPage.mock.calls).toEqual([[1], [2], [3]]);
  });

  it('không có tour nào (totalPages 0): chỉ gọi trang 1, trả rỗng', async () => {
    const fetchPage = pages([[]], 0);
    const out = await collectAllPages(fetchPage, { maxPages: 20, key });
    expect(out.items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  // Chặn trần để một `totalPages` hỏng từ API không kéo build đi vô tận. Trả
  // lại `totalPages` thật để nơi gọi biết đã bị cắt.
  it('vượt trần: dừng ở maxPages nhưng vẫn báo totalPages thật', async () => {
    const fetchPage = pages(
      Array.from({ length: 5 }, (_, index) => [{ id: `p${index + 1}` }]),
      5,
    );
    const out = await collectAllPages(fetchPage, { maxPages: 3, key });
    expect(ids(out.items)).toEqual(['p1', 'p2', 'p3']);
    expect(out.totalPages).toBe(5);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  // Tour mới tạo giữa hai lượt gọi đẩy mọi tour lùi một bậc (sắp theo ngày tạo
  // mới nhất trước), nên tour cuối trang 1 hiện lại ở đầu trang 2.
  it('bỏ tour trùng giữa hai trang, giữ lần xuất hiện đầu', async () => {
    const fetchPage = pages([
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'b' }, { id: 'c' }],
    ]);
    const out = await collectAllPages(fetchPage, { maxPages: 20, key });
    expect(ids(out.items)).toEqual(['a', 'b', 'c']);
  });

  // Không nuốt lỗi để trả nửa danh sách: nơi gọi tự quyết `settle` hay để build
  // đỏ, đúng như khi chỉ gọi một trang.
  it('một trang lỗi thì ném lỗi ấy, không trả danh sách thiếu', async () => {
    const boom = new Error('API down');
    const fetchPage = vi.fn(async (page: number) => {
      if (page === 2) throw boom;
      return { items: [{ id: `p${page}` }], totalPages: 3 };
    });
    await expect(collectAllPages(fetchPage, { maxPages: 20, key })).rejects.toBe(boom);
  });
});
