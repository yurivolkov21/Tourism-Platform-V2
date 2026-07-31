import type {
  TourDepartureFixture,
  TourDestinationFixture,
  TourFaqFixture,
  TourFixture,
  TourItineraryDayFixture,
  TourPolicyFixture,
} from './types.js';

/**
 * Fixture 12 tour miền BẮC (roster #1–#12, spec
 * 2026-07-31-tours-catalogue-api-design.md §3) — RỖNG Ở TASK 1, nội dung viết
 * ở Task 2 của plan `docs/plans/2026-07-31-tours-catalogue-api.md`. Shape
 * từng phần tử xem `./types.js` (đã kiểm khớp `fixtures/catalog.ts` cũ, file
 * đó đã xoá ở cùng commit tách này — xem báo cáo Task 1).
 *
 * Dải UUID được cấp cho miền này (Global Constraints của plan + quy ước mở
 * rộng của Task 1 cho itinerary/faq/policy/departure — KHÔNG đụng series cũ
 * `d0000001-…`/`d1000001-…`/`d2000001-…`/`d3000001-…`/`e0000001-…`):
 *   - `tours[].id`             d0000002-0000-4000-8000-0000000000{01..12}
 *     (NN = đúng cột # của roster spec §3 — tour #1 Hà Nội food night = 01 …
 *     tour #12 Vietnam Grand Journey = 12).
 *   - `tourItineraryDays[].id` f0000002-0000-4000-8000-000000000001 →
 *     …000000000100 (dải riêng cho miền Bắc; Trung dùng 101–200, Nam dùng
 *     201–300 — xem `tours-central.ts`/`tours-south.ts` — để 3 file không
 *     đụng số dù viết song song).
 *   - `tourFaqs[].id`          d2000002-0000-4000-8000-000000000001 → …0100
 *   - `tourPolicies[].id`      d3000002-0000-4000-8000-000000000001 → …0100
 *   - `tourDepartures[].id`    e0000002-0000-4000-8000-000000000001 → …0100
 */

export const tours: TourFixture[] = [];

export const tourDestinations: TourDestinationFixture[] = [];

export const tourItineraryDays: TourItineraryDayFixture[] = [];

export const tourFaqs: TourFaqFixture[] = [];

export const tourPolicies: TourPolicyFixture[] = [];

export const tourDepartures: TourDepartureFixture[] = [];
