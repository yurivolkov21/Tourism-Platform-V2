import type {
  TourDepartureFixture,
  TourDestinationFixture,
  TourFaqFixture,
  TourFixture,
  TourItineraryDayFixture,
  TourPolicyFixture,
} from './types.js';

/**
 * Fixture 9 tour miền NAM (roster #22–#30, spec
 * 2026-07-31-tours-catalogue-api-design.md §3) — RỖNG Ở TASK 1, nội dung viết
 * ở Task 4 của plan `docs/plans/2026-07-31-tours-catalogue-api.md` (kèm tour
 * MẪU #22 Vũng Tàu Coastal Escape — spec §5, chuẩn 100% để đối chiếu). Shape
 * từng phần tử xem `./types.js` (đã kiểm khớp `fixtures/catalog.ts` cũ, file
 * đó đã xoá ở cùng commit tách này — xem báo cáo Task 1).
 *
 * Dải UUID được cấp cho miền này (Global Constraints của plan + quy ước mở
 * rộng của Task 1 cho itinerary/faq/policy/departure — KHÔNG đụng series cũ
 * `d0000001-…`/`d1000001-…`/`d2000001-…`/`d3000001-…`/`e0000001-…`):
 *   - `tours[].id`             d0000002-0000-4000-8000-0000000000{22..30}
 *     (NN = đúng cột # của roster spec §3 — tour #22 Vũng Tàu Coastal Escape
 *     = 22 … tour #30 Côn Đảo History & Nature = 30).
 *   - `tourItineraryDays[].id` f0000002-0000-4000-8000-000000000201 →
 *     …000000000300 (dải riêng cho miền Nam; Bắc dùng 1–100, Trung dùng
 *     101–200 — xem `tours-north.ts`/`tours-central.ts` — để 3 file không
 *     đụng số dù viết song song).
 *   - `tourFaqs[].id`          d2000002-0000-4000-8000-000000000201 → …0300
 *   - `tourPolicies[].id`      d3000002-0000-4000-8000-000000000201 → …0300
 *   - `tourDepartures[].id`    e0000002-0000-4000-8000-000000000201 → …0300
 */

export const tours: TourFixture[] = [];

export const tourDestinations: TourDestinationFixture[] = [];

export const tourItineraryDays: TourItineraryDayFixture[] = [];

export const tourFaqs: TourFaqFixture[] = [];

export const tourPolicies: TourPolicyFixture[] = [];

export const tourDepartures: TourDepartureFixture[] = [];
