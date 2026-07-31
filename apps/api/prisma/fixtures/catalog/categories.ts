/**
 * Fixture 6 tour category — copy NGUYÊN VĂN từ `fixtures/catalog.ts` cũ (file
 * đó đã xoá ở cùng commit tách này). Spec 2026-07-31-tours-catalogue-api-design
 * giữ nguyên bộ category này khi thay trọn bộ tour: 5 category active + 1
 * `seasonal-classics` inactive (giữ lại để tham chiếu lưu trữ, không gán tour
 * mới nào vào category này).
 */

export const tourCategories = [
  {
    id: 'b0000001-0000-4000-8000-000000000001',
    slug: 'day',
    name: 'Day Tours',
    description: 'Single-day experiences and excursions, back to your hotel by evening.',
    order: 1,
    isActive: true,
    createdAt: '2025-12-23T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'b0000001-0000-4000-8000-000000000002',
    slug: 'package',
    name: 'Multi-day Packages',
    description: 'Multi-day journeys combining several regions with overnight stays.',
    order: 2,
    isActive: true,
    createdAt: '2025-12-23T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'b0000001-0000-4000-8000-000000000003',
    slug: 'cruise',
    name: 'Cruises',
    description: 'Overnight bay and river cruises aboard boutique junks and sampans.',
    order: 3,
    isActive: true,
    createdAt: '2025-12-23T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'b0000001-0000-4000-8000-000000000004',
    slug: 'trekking',
    name: 'Trekking & Adventure',
    description: 'Mountain treks, homestays, and active adventures off the tarmac.',
    order: 4,
    isActive: true,
    createdAt: '2025-12-23T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'b0000001-0000-4000-8000-000000000005',
    slug: 'honeymoon',
    name: 'Honeymoon',
    description: 'Romantic, unhurried itineraries designed for couples.',
    order: 5,
    isActive: true,
    createdAt: '2025-12-23T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'b0000001-0000-4000-8000-000000000006',
    slug: 'seasonal-classics',
    name: 'Seasonal Classics',
    description: 'Retired seasonal departures kept for archival reference only.',
    order: 6,
    isActive: false,
    createdAt: '2025-12-23T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
];
