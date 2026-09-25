/**
 * Thang đo của màn Home, suy TOÀN BỘ từ kích thước thiết bị — không số dp
 * cứng nào lấy từ ảnh mẫu. Ảnh mẫu chỉ nói QUAN HỆ TỈ LỆ giữa các khối:
 *
 *   [ rail vùng ~13% ][ thẻ đang xem ~68% ][ thẻ kế ló ra phần còn lại ]
 *
 * Tách ra file riêng (không nằm trong component) để test được bằng số, và để
 * mọi khối trên màn đọc cùng MỘT nguồn kích thước thay vì mỗi chỗ tự chế.
 */

export interface HomeMetricsInput {
  /** `useWindowDimensions().width` */
  width: number;
  /** `useWindowDimensions().height` */
  height: number;
}

export interface HomeMetrics {
  /** Bề rộng thẻ địa danh đang xem. */
  cardWidth: number;
  /** Chiều cao thẻ — kẹp theo CẢ bề rộng lẫn chiều cao máy. */
  cardHeight: number;
}

/** Kẹp `value` vào khoảng [min, max] — tương đương `clamp()` của CSS. */
function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), max));
}

/**
 * Tỉ lệ lấy từ ảnh mẫu, kèm trần/sàn để máy rất nhỏ hay rất lớn không vỡ bố
 * cục (thẻ hẹp quá thì chữ vỡ dòng, rộng quá thì mất phần "ló" của thẻ kế).
 */
export function homeMetrics({ width, height }: HomeMetricsInput): HomeMetrics {
  const cardWidth = clamp(width * 0.68, 232, 360);

  // Thẻ chân dung. Chiều cao đi theo bề rộng (giữ tỉ lệ ảnh) NHƯNG không bao
  // giờ vượt quá nửa chiều cao máy — máy thấp thì thẻ tự lùn lại thay vì đẩy
  // thanh tab ra khỏi màn.
  const cardHeight = clamp(cardWidth * 1.4, 0, height * 0.52);

  return { cardWidth, cardHeight };
}
