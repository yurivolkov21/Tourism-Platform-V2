import type { MockRegion } from './types.js';

// 3 vùng — tên user-facing tiếng Anh (KHÔNG dùng codename nội bộ của tokens).
export const REGIONS: MockRegion[] = [
  {
    key: 'north',
    name: 'Northern Vietnam',
    tagline: 'Limestone bays, misty terraces, mountain passes',
    tourCount: 24,
  },
  {
    key: 'central',
    name: 'Central Vietnam',
    tagline: 'Imperial cities, lantern towns, coastal roads',
    tourCount: 27,
  },
  {
    key: 'south',
    name: 'Southern Vietnam',
    tagline: 'River markets, orchards, delta life',
    tourCount: 17,
  },
];
