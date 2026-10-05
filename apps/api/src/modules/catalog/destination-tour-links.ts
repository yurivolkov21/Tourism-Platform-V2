import { tourRevalidationTags } from '../web-revalidation/revalidation-decision.js';

/**
 * Logic THUẦN đọc liên kết tour của một điểm đến (ADR-0053 §5, nợ G5): hai con số tour của
 * hàng admin, và tag cache cần bust sau lệnh sửa hay ẩn/hiện. Tách khỏi service để test
 * không cần DB — cùng nếp `departure-rules.ts`.
 */

/**
 * Một liên kết tour như select lồng của service trả về. Kiểu Prisma khai `tour` KHÔNG null
 * (quan hệ bắt buộc) nhưng ở đây không tin được: quan hệ đi hai bước `tour_destinations` →
 * `tours`, Prisma 7.8 đọc mỗi bước bằng một câu SQL riêng, và tour bị xoá đúng giữa hai câu
 * thì liên kết vẫn về với `tour: null` (đo 05/10). Bỏ qua dòng ấy là đúng nghĩa: tour không
 * còn thì không được đếm, cũng không còn trang nào để bust.
 */
export interface TourLink<Tour> {
  tour: Tour | null;
}

/** Hai con số tour của một hàng — xem `DESTINATION_SELECT` ở `admin-destinations.service.ts`. */
export interface TourCounts {
  tourCount: number;
  linkedTourCount: number;
}

/** Tour còn tồn tại của các liên kết — bỏ dòng `tour: null`, xem `TourLink`. */
function presentTours<Tour>(links: ReadonlyArray<TourLink<Tour>>): Tour[] {
  return links.flatMap((link) => (link.tour === null ? [] : [link.tour]));
}

export function countTours(links: ReadonlyArray<TourLink<{ isPublished: boolean }>>): TourCounts {
  const tours = presentTours(links);
  return {
    tourCount: tours.filter((tour) => tour.isPublished).length,
    linkedTourCount: tours.length,
  };
}

/** Tag cần bust sau khi sửa hoặc ẩn/hiện một điểm đến — `tours` cộng trang của mọi tour gắn nó. */
export function writtenTags(links: ReadonlyArray<TourLink<{ slug: string }>>): string[] {
  return [
    ...new Set([
      'tours',
      ...presentTours(links).flatMap((tour) => tourRevalidationTags(tour.slug)),
    ]),
  ];
}
