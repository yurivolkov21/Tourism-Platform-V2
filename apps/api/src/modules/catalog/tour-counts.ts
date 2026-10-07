/**
 * Hai con số tour của MỘT hàng danh mục hay điểm đến (ADR-0053 §5) — một bản cho cả hai bảng
 * (review RU1: trước đó danh mục giữ một bản chép riêng, không có unit test).
 *
 * - `tourCount`: tour ĐÃ ĐĂNG — nuôi câu cảnh báo lúc ẩn, cùng thước với bề mặt công khai: câu
 *   cảnh báo nói về thứ khách đang thấy, mà tour nháp thì không ai thấy.
 * - `linkedTourCount`: tour MỌI trạng thái — quyết nút Delete (tour nháp vẫn chặn xoá).
 *
 * Hai số đếm trên CÙNG MỘT danh sách nên `tourCount ≤ linkedTourCount` luôn đúng.
 */
export interface TourCounts {
  tourCount: number;
  linkedTourCount: number;
}

/** Hàng chưa có tour nào — hàng vừa tạo, hay hàng vắng mặt ở câu đếm gom theo hàng. */
export const NO_TOURS: Readonly<TourCounts> = Object.freeze({ tourCount: 0, linkedTourCount: 0 });

export function countTours(tours: ReadonlyArray<{ isPublished: boolean }>): TourCounts {
  return {
    tourCount: tours.filter((tour) => tour.isPublished).length,
    linkedTourCount: tours.length,
  };
}
