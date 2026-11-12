import type { TourCardVM } from '@/lib/api/tours';

/**
 * Điểm trung bình và tổng số đánh giá của TOÀN catalogue, cộng từ hai cột denormalize trên
 * thẻ tour (`ratingAvg`, `ratingCount` — cập nhật trong cùng transaction duyệt review). Không
 * cần endpoint mới: Home và About vốn đã tải `fetchTours()`.
 *
 * Trung bình có TRỌNG SỐ theo `ratingCount` — một tour 1 đánh giá 5★ không được kéo điểm ngang
 * một tour 5 đánh giá. `ratingAvg` mỗi tour đã làm tròn 1 chữ số ở DB nên kết quả có thể lệch
 * điểm trung bình thật của bảng `reviews` tối đa 0.05 — dưới mức chữ số in ra (đo 12/11/2026:
 * từ thẻ ra 4.32, từ bảng ra 4.31, cùng in 4.3).
 *
 * `average` null khi chưa có đánh giá nào: chưa ai chấm không phải bị chấm 0 điểm.
 */
export function reviewSummary(tours: readonly Pick<TourCardVM, 'ratingAvg' | 'ratingCount'>[]): {
  count: number;
  average: number | null;
} {
  let count = 0;
  let weighted = 0;
  for (const tour of tours) {
    if (tour.ratingAvg === null || tour.ratingCount === 0) continue;
    count += tour.ratingCount;
    weighted += tour.ratingAvg * tour.ratingCount;
  }
  return { count, average: count === 0 ? null : Math.round((weighted / count) * 10) / 10 };
}

/**
 * Ba con số CHƯA có endpoint công khai nào trả về, nên không đếm sống được: đọc thẳng từ DB
 * production bằng SQL chỉ-đọc ngày 12/11/2026 rồi làm tròn XUỐNG để dấu "+" luôn đúng. Dữ liệu
 * production chốt giữ nguyên tới buổi bảo vệ (không seed lại), nên số không trôi; seed lại hay
 * muốn số tự cập nhật thì phải có endpoint thống kê công khai — chưa làm.
 *
 * Định nghĩa từng số, để người sau đo lại đúng cách:
 * - `travellersHosted`: tổng `num_adults + num_children` của booking `PAID` có
 *   `departure_end_date` trước hôm nay — khách đã đi xong chuyến, không tính đơn đã huỷ hay
 *   hoàn tiền. Đo được 1,312.
 * - `departuresThisYear`: số `tour_departures` khởi hành trong năm 2026, trừ chuyến `CANCELLED`.
 *   Đo được 273 (tổng 292, có 19 chuyến bị huỷ).
 * - `satisfactionPercent`: phần trăm review đã duyệt chấm 4★ hoặc 5★. Đo được 88.7% trên 106
 *   review — làm tròn xuống 88.
 */
export const MEASURED_STATS = {
  travellersHosted: 1300,
  departuresThisYear: 270,
  satisfactionPercent: 88,
} as const;
