import type { TourReviewFixture } from './types.js';

/**
 * Fixture review CURATED cho tour — RỖNG Ở TASK 1, nội dung viết ở Task 5 của
 * plan `docs/plans/2026-07-31-tours-catalogue-api.md` (spec
 * 2026-07-31-tours-catalogue-api-design.md §4 — "Reviews CURATED"). Shape
 * từng phần tử: `TourReviewFixture` (`./types.js`) — field `source`/
 * `isApproved` seed.ts TỰ GẮN ở bước 6 (KHÔNG khai ở fixture), không có
 * `userId`/`bookingId` (CURATED không cần gắn người dùng/booking thật — FK
 * nullable có chủ đích trong schema).
 *
 * Series UUID MỚI (Global Constraints của plan): `a0000002-0000-4000-8000-
 * 0000000000NN`, đánh số tuần tự theo thứ tự viết (không cần khớp cột #
 * roster — mỗi tour có 0–5 review, không phải 1 review/tour).
 *
 * Sau khi insert, seed.ts recompute `ratingAvg`/`ratingCount` trên bảng
 * `Tour` cho MỌI tour (kể cả tour không có review nào ở đây → `ratingAvg`
 * `null`, khác `0` — spec §4 nhấn mạnh tri-state này). 6 tour CỐ Ý 0 review
 * do Task 5 chọn và ghi rõ trong bản cập nhật của file này.
 */

export const tourReviews: TourReviewFixture[] = [];
