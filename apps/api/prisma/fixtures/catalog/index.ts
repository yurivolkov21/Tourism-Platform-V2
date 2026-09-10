/**
 * Cửa vào DUY NHẤT của fixtures catalog — ghép 3 file miền (Bắc/Trung/Nam)
 * thành các mảng seed.ts đang import, cộng `tourReviews` (mới, spec
 * 2026-07-31-tours-catalogue-api-design.md §4). Trước khi tách folder này,
 * toàn bộ ở một file `fixtures/catalog.ts` (23 tour cũ, đã xoá cùng commit
 * tách này) — xem `docs/plans/2026-07-31-tours-catalogue-api.md` Task 1.
 *
 * Thứ tự concat các mảng miền LUÔN Bắc → Trung → Nam, khớp thứ tự roster spec
 * §3 (tour #1–12 → #13–21 → #22–30) để dải UUID tĩnh của từng miền (xem
 * comment đầu mỗi file `tours-*.ts`) không lẫn lộn khi đọc log seed.
 */

import { tourCategories } from './categories.js';
import { destinations } from './destinations.js';
import { tourReviews } from './reviews.js';
import { tourCostItems } from './tour-costs.js';
import * as toursCentral from './tours-central.js';
import * as toursNorth from './tours-north.js';
import * as toursSouth from './tours-south.js';

export { destinations, tourCategories, tourCostItems, tourReviews };

export const tours = [...toursNorth.tours, ...toursCentral.tours, ...toursSouth.tours];

export const tourDestinations = [
  ...toursNorth.tourDestinations,
  ...toursCentral.tourDestinations,
  ...toursSouth.tourDestinations,
];

export const tourItineraryDays = [
  ...toursNorth.tourItineraryDays,
  ...toursCentral.tourItineraryDays,
  ...toursSouth.tourItineraryDays,
];

export const tourFaqs = [...toursNorth.tourFaqs, ...toursCentral.tourFaqs, ...toursSouth.tourFaqs];

export const tourPolicies = [
  ...toursNorth.tourPolicies,
  ...toursCentral.tourPolicies,
  ...toursSouth.tourPolicies,
];

// Lịch khởi hành KHÔNG còn nằm trong ba file miền: từ 10/09/2026 nó được SINH
// cho trọn năm 2026 bởi `departures-2026.ts`. Xem doc-comment ở đó để biết ba
// phân rã của bộ 134 ngày gõ tay cũ mà mô hình này vá.
export { tourDepartures } from './departures-2026.js';
