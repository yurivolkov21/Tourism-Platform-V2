import type { MockRegion } from './types.js';

// 3 vùng — tên user-facing tiếng Anh (KHÔNG dùng codename nội bộ của tokens).
export const REGIONS: MockRegion[] = [
  {
    key: 'north',
    slug: 'northern-vietnam',
    name: 'Northern Vietnam',
    tagline: 'Limestone bays, misty terraces, mountain passes',
  },
  {
    key: 'central',
    slug: 'central-vietnam',
    name: 'Central Vietnam',
    tagline: 'Imperial cities, lantern towns, coastal roads',
  },
  {
    key: 'south',
    slug: 'southern-vietnam',
    name: 'Southern Vietnam',
    tagline: 'River markets, orchards, delta life',
  },
];
