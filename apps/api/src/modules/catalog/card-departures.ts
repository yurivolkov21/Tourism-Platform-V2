import { isWithinDeadline, type TourNextDeparture } from '@tourism/contract';

/**
 * Luật "đợt nuôi thẻ tour" (ADR-0058 §1–§2) — THUẦN, không chạm Prisma.
 *
 * Thẻ tour đọc các đợt qua ĐÚNG ba con số: giá "from", ngày của đợt kế tiếp và số chỗ còn lại
 * của đợt ấy. Cả ba tính trên cùng MỘT tập đợt, và lệnh ghi đợt của admin quyết định có bust
 * cache trang danh sách hay không cũng theo tập ấy (`departureRevalidationTags`) — một vị từ,
 * ba chỗ đọc, để thẻ không bao giờ in giá của đợt này cạnh ngày của đợt khác.
 */

/** Đúng những gì về một đợt mà vị từ cần — hàng Prisma, hàng khoá `FOR UPDATE` hay DTO đều vừa. */
export interface CardDepartureCandidate {
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  /** Ngày lịch Việt Nam `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  seatsLeft: number;
}

/**
 * Đợt này nuôi thẻ tour: `OPEN`, còn trong hạn đặt (ADR-0041, so theo ngày Việt Nam) và còn
 * chỗ — đúng vị từ `isDepartureOpen` mà mọi chỗ chọn đợt của web đang dùng.
 *
 * "Chưa khởi hành" không cần xét riêng: hạn chót luôn đứng trước ngày khởi hành, nên còn hạn
 * đặt thì chắc chắn chưa đi.
 */
export function feedsTourCard(departure: CardDepartureCandidate, now: Date): boolean {
  return (
    departure.status === 'OPEN' &&
    departure.seatsLeft > 0 &&
    isWithinDeadline(now, departure.startDate, departure.endDate)
  );
}

/**
 * Đợt kế tiếp đặt được của MỘT tour, hoặc `null` khi không còn đợt nào.
 *
 * Tự lọc bằng `feedsTourCard` chứ không tin chỗ gọi đã lọc: hàm này là nơi duy nhất quyết
 * "đợt kế tiếp" nên luật phải nằm trọn trong nó. Sớm nhất theo `startDate` (chuỗi `YYYY-MM-DD`
 * so theo thứ tự từ điển là đúng thứ tự ngày); hai đợt cùng ngày thì lấy đợt còn NHIỀU chỗ hơn
 * — báo "Only 2 seats left" khi cùng ngày ấy còn một đợt rộng là doạ khách oan.
 *
 * Trả object MỚI chỉ hai trường: hàng truyền vào có thể mang `id`, giá, cột Prisma — không cột
 * nào được lọt ra payload công khai.
 */
export function nextDepartureOf(
  departures: readonly CardDepartureCandidate[],
  now: Date,
): TourNextDeparture | null {
  let best: CardDepartureCandidate | null = null;
  for (const departure of departures) {
    if (!feedsTourCard(departure, now)) continue;
    if (
      best === null ||
      departure.startDate < best.startDate ||
      (departure.startDate === best.startDate && departure.seatsLeft > best.seatsLeft)
    ) {
      best = departure;
    }
  }
  return best === null ? null : { startDate: best.startDate, seatsLeft: best.seatsLeft };
}
