import type { WishlistItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { wishlistToTourCardVM } from './wishlist-vm';

function makeItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a',
    slug: 'ninh-binh-trang-an-day',
    title: 'Ninh Bình: Tràng An, Múa Cave & Rice Fields',
    basePrice: '79.00',
    currency: 'USD',
    durationDays: 1,
    ratingAvg: 4.8,
    ratingCount: 132,
    addedAt: '2026-07-28T14:00:00.000Z',
    unavailable: false,
    ...overrides,
  };
}

describe('wishlistToTourCardVM', () => {
  it('map field cùng tên trực tiếp, field catalogue thiếu (destinations/category/…) nhận default trung tính không render', () => {
    const item = makeItem();
    const vm = wishlistToTourCardVM(item);
    expect(vm.id).toBe(item.tourId);
    expect(vm.slug).toBe(item.slug);
    expect(vm.title).toBe(item.title);
    expect(vm.basePrice).toBe(item.basePrice);
    expect(vm.currency).toBe(item.currency);
    expect(vm.durationDays).toBe(item.durationDays);
    expect(vm.ratingAvg).toBe(item.ratingAvg);
    expect(vm.ratingCount).toBe(item.ratingCount);
    // Field WishlistItem không có — default trung tính, TourCard không render
    // field nào trong nhóm này (đã đối chiếu tour-card.tsx JSDoc).
    expect(vm.summary).toBeNull();
    expect(vm.compareAtPrice).toBeNull();
    expect(vm.difficulty).toBeNull();
    expect(vm.destinations).toEqual([]);
    expect(vm.isFeatured).toBe(false);
  });
});
