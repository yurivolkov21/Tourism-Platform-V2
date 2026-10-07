import { tourRevalidationTags } from '../web-revalidation/revalidation-decision.js';
import { countTours, type TourCounts } from './tour-counts.js';

/**
 * Logic THUẦN đọc liên kết tour của một điểm đến (ADR-0053 §5, nợ G5): hai con số tour của
 * hàng admin sau lệnh sửa hay ẩn/hiện, và tag cache cần bust sau hai lệnh ấy. Tách khỏi service
 * để test không cần DB — cùng nếp `departure-rules.ts`. Luật đếm nằm ở `tour-counts.ts`, dùng
 * chung với danh mục; ở đây chỉ bóc tour còn tồn tại khỏi liên kết.
 */

/**
 * Một liên kết tour như select lồng của service trả về. Kiểu Prisma khai `tour` KHÔNG null
 * (quan hệ bắt buộc) nhưng ở đây không tin được: quan hệ đi hai bước `tour_destinations` →
 * `tours`, Prisma 7.8 đọc mỗi bước bằng một câu SQL riêng, và tour bị xoá đúng giữa hai câu
 * thì liên kết vẫn về với `tour: null` (đo 05/10). Bỏ qua dòng ấy là đúng nghĩa: tour không
 * còn thì không được đếm, cũng không còn trang nào để bust.
 *
 * Service khai lại hàng Prisma bằng kiểu này ngay lúc nhận (review AL6), nên mọi lượt đọc
 * `tours[].tour` buộc phải kiểm null — tức là đi qua hai hàm dưới đây.
 */
export interface TourLink<Tour> {
  tour: Tour | null;
}

/** Tour còn tồn tại của các liên kết — bỏ dòng `tour: null`, xem `TourLink`. */
function presentTours<Tour>(links: ReadonlyArray<TourLink<Tour>>): Tour[] {
  return links.flatMap((link) => (link.tour === null ? [] : [link.tour]));
}

/** Hai con số tour của một điểm đến, đếm trên tour còn tồn tại của liên kết — xem `countTours`. */
export function countLinkedTours(
  links: ReadonlyArray<TourLink<{ isPublished: boolean }>>,
): TourCounts {
  return countTours(presentTours(links));
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
