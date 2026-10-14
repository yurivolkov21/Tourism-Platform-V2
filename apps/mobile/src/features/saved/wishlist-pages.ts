/**
 * Phân trang `wishlist.list` cho tab Saved (L5, review nhánh account).
 *
 * Trước đây Saved chỉ xin MỘT trang `pageSize: 100` — khách lưu hơn 100 tour
 * thì mục thứ 101 trở đi biến mất và bộ đếm nói sai. Contract kẹp `pageSize`
 * tối đa 100 nên không nới được; route tải lần lượt hết các trang qua
 * `useInfiniteQuery` rồi gộp lại bằng hai hàm dưới.
 */

/** Trang kế cần tải, `undefined` khi đã hết (quy ước `getNextPageParam`). */
export function nextWishlistPage(last: { page: number; totalPages: number }): number | undefined {
  return last.page < last.totalPages ? last.page + 1 : undefined;
}

/**
 * Nối item của mọi trang đã tải. Bỏ mục trùng `tourId` (giữ lần đầu): danh
 * sách xếp mới nhất trước, khách lưu thêm giữa hai lần tải trang thì mục cuối
 * trang trước bị đẩy sang đầu trang sau — không lọc là hiện hai thẻ, trùng key.
 */
export function flattenWishlistPages<T extends { tourId: string }>(
  pages: readonly { items: readonly T[] }[] | undefined,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.tourId)) continue;
      seen.add(item.tourId);
      result.push(item);
    }
  }
  return result;
}

/**
 * Số tour của bộ đếm Saved (N9, rà 07/10). Còn trang chưa về thì đếm theo `total` server báo ở
 * trang mới nhất: đếm số mục đã tải là nói "100 tours" cho wishlist 150 mục suốt lúc trang sau
 * đang về. Trừ các mục khách vừa bỏ lưu trong số đã tải (`loaded − visible`, ẩn lạc quan), và
 * không bao giờ đếm ít hơn số thẻ đang hiện (`total` cũ hơn danh sách khi wishlist đổi giữa hai
 * lần tải). Tải hết trang thì số thẻ đang hiện là đúng nhất.
 */
export function wishlistCount(
  pages: readonly { total: number }[] | undefined,
  hasNextPage: boolean,
  loaded: number,
  visible: number,
): number {
  const latest = pages?.at(-1);
  if (latest === undefined || !hasNextPage) return visible;
  return Math.max(latest.total - (loaded - visible), visible);
}
