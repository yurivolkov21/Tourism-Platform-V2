import type { WishlistItem } from '@tourism/contract';

/**
 * Fixture `WishlistItem` dùng chung cho test trang `/account/saved` — trước đây
 * `saved-grid.spec.tsx` tự chép một bản `makeItem`, nay ba spec (thẻ, lưới, trang) cùng dùng.
 *
 * Mặc định: tour còn bán, có đánh giá, CHƯA có ảnh bìa (nhánh ô giữ chỗ là nhánh dễ vỡ hơn nên để
 * test chạy qua nó theo mặc định), lưu lúc 12:00 trưa 3/10 giờ Việt Nam — thẻ in "Saved 3 Oct".
 */
export function makeWishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a',
    slug: 'ninh-binh-trang-an-day',
    title: 'Ninh Bình: Tràng An, Múa Cave & Rice Fields',
    basePrice: '79.00',
    currency: 'USD',
    durationDays: 1,
    destinationName: 'Ninh Bình',
    ratingAvg: 4.8,
    ratingCount: 132,
    cover: null,
    addedAt: '2026-10-03T05:00:00.000Z',
    unavailable: false,
    ...overrides,
  };
}
