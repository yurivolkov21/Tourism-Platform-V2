import type { AdminTourDetail } from '@tourism/contract';

/**
 * Kết cục lượt đọc tour của LAYOUT khu làm việc (vòng review F17).
 *
 * Tab Departures (F12, đang vận hành thật: tạo, đóng, huỷ chuyến có hoàn tiền)
 * tự đọc dữ liệu của nó; chỉ phần đầu của khu làm việc cần `admin.tours.get`.
 * Lượt đọc ấy hỏng — điển hình là khe deploy: Vercel đưa admin lên trước khi
 * Render đưa API lên, route `GET /api/admin/tours/{slug}` chưa có — thì phần đầu
 * vắng mặt nhưng tab Departures vẫn phải sống. Ném tiếp ở layout là kéo cả tab
 * ấy xuống trang lỗi, đúng lớp lỗi vòng review F16 từng vá.
 *
 * Bốn tab còn lại đọc lại cùng lượt ấy (React `cache()`), nên chúng vẫn ra trang
 * lỗi như cũ — chúng không có gì để hiện khi không đọc được tour.
 */
export type WorkspaceTour =
  | { kind: 'found'; detail: AdminTourDetail }
  | { kind: 'missing' }
  | { kind: 'unavailable' };

export async function settleWorkspaceTour(
  load: Promise<AdminTourDetail | null>,
): Promise<WorkspaceTour> {
  try {
    const detail = await load;
    return detail ? { kind: 'found', detail } : { kind: 'missing' };
  } catch {
    return { kind: 'unavailable' };
  }
}
