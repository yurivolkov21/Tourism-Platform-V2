import { type AdminTourDetail, AdminTourDetailSchema, tourReadiness } from '@tourism/contract';

/**
 * Fixture `AdminTourDetail` DÙNG CHUNG cho mọi spec admin của F17 (khu làm việc
 * tour) — cùng nếp `departure-row.ts`: contract thêm một field là sửa đúng một chỗ.
 *
 * Gốc là một tour 3 ngày ĐANG BÁN, đủ để bán, một điểm đến chính, không chuyến,
 * không booking. Ca test đè đúng thứ nó cần bằng `patch`.
 *
 * `readiness` là phần SUY RA — server tính nó từ tóm tắt, điểm đến, số ngày và
 * lịch trình, nên fixture cũng tính bằng CHÍNH hàm của contract sau khi đè (trừ
 * khi ca test đè thẳng `readiness`). Điền tay thì dễ ghép một readiness nói ngược
 * dữ liệu — một hàng server không bao giờ gửi ra. Kết quả parse qua
 * `AdminTourDetailSchema` để một fixture lệch hình dạng đỏ ngay ở đây.
 */
export const TOUR_ID = '7a1b2c3d-0000-4000-8000-000000000001';
export const CATEGORY_ID = '7a1b2c3d-0000-4000-8000-0000000000c1';
export const HIDDEN_CATEGORY_ID = '7a1b2c3d-0000-4000-8000-0000000000c2';
export const DEST_A = '7a1b2c3d-0000-4000-8000-0000000000d1';
export const DEST_B = '7a1b2c3d-0000-4000-8000-0000000000d2';
export const HIDDEN_DEST = '7a1b2c3d-0000-4000-8000-0000000000d3';
export const VERSION = '2026-09-24T10:11:12.345Z';

const BASE: Omit<AdminTourDetail, 'readiness'> = {
  id: TOUR_ID,
  slug: 'ha-long-bay-cruise',
  version: VERSION,
  title: 'Ha Long Bay Cruise',
  summary: 'Three days on the bay.',
  categoryId: CATEGORY_ID,
  difficulty: 'EASY',
  isFeatured: false,
  isPublished: true,
  durationDays: 3,
  maxGroupSize: 12,
  basePrice: '199.00',
  currency: 'USD',
  costPrice: null,
  ratingAvg: null,
  ratingCount: 0,
  suitableFor: ['COUPLE'],
  badges: [],
  highlights: ['Sunset kayak'],
  included: ['Meals'],
  excluded: [],
  meetingPoint: 'Tuan Chau harbour',
  factDurationNote: null,
  factGroupSizeNote: null,
  factDifficultyNote: null,
  factGoodForNote: null,
  destinations: [{ destinationId: DEST_A, isPrimary: true }],
  itinerary: [
    { dayNumber: 1, title: 'Board the boat', description: '09:00 — Pick-up at your hotel' },
    { dayNumber: 2, title: 'Kayak the lagoons', description: null },
    { dayNumber: 3, title: 'Back to Hanoi', description: null },
  ],
  faqs: [],
  policies: [],
  costItems: [],
  departureCount: 0,
  liveSeatsMax: null,
  bookingCount: 0,
};

export function detailFixture(patch: Partial<AdminTourDetail> = {}): AdminTourDetail {
  const merged = { ...BASE, ...patch };
  const readiness =
    patch.readiness ??
    tourReadiness({
      summary: merged.summary,
      destinations: merged.destinations,
      durationDays: merged.durationDays,
      itineraryDays: merged.itinerary.map((day) => day.dayNumber),
    });
  return AdminTourDetailSchema.parse({ ...merged, readiness });
}
