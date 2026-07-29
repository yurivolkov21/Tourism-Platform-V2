import type { MockRegion } from './types.js';

// 3 vùng — tên user-facing tiếng Anh (KHÔNG dùng codename nội bộ của tokens).
// KHÔNG có `tagline` ở đây: phụ đề hero đến từ
// `messages.regionPage.regions[key].tagline`. Xem ghi chú ở `MockRegion`.
export const REGIONS: MockRegion[] = [
  { key: 'north', slug: 'northern-vietnam', name: 'Northern Vietnam' },
  { key: 'central', slug: 'central-vietnam', name: 'Central Vietnam' },
  { key: 'south', slug: 'southern-vietnam', name: 'Southern Vietnam' },
];
