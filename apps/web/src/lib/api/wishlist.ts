import type { WishlistItem } from '@tourism/contract';
import { api, withAuthHeaders } from './client';

/**
 * Trần `pageSize` của `PageQuerySchema` (input `wishlist.list`) — dùng để lấy
 * "gần như toàn bộ" wishlist trong MỘT call, cùng lý do `DASHBOARD_BOOKINGS_
 * LIMIT` ở `bookings.ts`: `/account/saved` và khối "3 tour đã lưu" trên
 * dashboard đều không có UI phân trang riêng cho wishlist (spec §3), nên một
 * page đủ lớn xấp xỉ "tất cả" cho quy mô capstone. User có > 100 tour đã lưu
 * sẽ bị cắt bớt — chấp nhận được, ghi rõ không âm thầm.
 */
const WISHLIST_MAX_PAGE_SIZE = 100;

/**
 * Wishlist của chính user, mới nhất trước. Chỉ trả `.items` (dashboard +
 * `/account/saved` đều chỉ cần mảng — không trang nào cần `total`/`totalPages`
 * của wishlist, khác `bookings.mine` ở `bookings.ts`).
 */
export async function fetchMyWishlist(cookie: string): Promise<WishlistItem[]> {
  const page = await api.wishlist.list(
    { page: 1, pageSize: WISHLIST_MAX_PAGE_SIZE },
    { context: withAuthHeaders(cookie) },
  );
  return page.items;
}
