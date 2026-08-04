import type { Booking } from '@tourism/contract';

/**
 * Bốn ô số dashboard (spec §3, "đếm từ bookings+wishlist"). Quyết định thiết
 * kế (ghi rõ vì brief chỉ khoá cứng luật cho `nextTrip`, không khoá
 * `dashboardStats`): CHỈ booking `PAID` được tính là "chuyến đi" —
 * `PENDING` chưa xác nhận tiền, `CANCELLED`/`REFUNDED`/`PARTIALLY_REFUNDED`
 * không còn/chưa từng là chuyến khách sẽ đi (booking-states.md). Nhờ vậy
 * `trips === upcoming + completed` luôn đúng, ba ô không bao giờ lệch nhau.
 */
export interface DashboardStats {
  trips: number;
  upcoming: number;
  completed: number;
  saved: number;
}

/**
 * "Hôm nay" dạng `YYYY-MM-DD` (UTC) — cùng format thuần ngày với
 * `departureStartDate` (`z.iso.date()`, không giờ/múi giờ) nên so sánh
 * lexicographic (`>=`/`<`) là đủ đúng thứ tự thời gian, khỏi parse `Date`.
 */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Departure hôm nay hoặc tương lai coi là "sắp tới" — chuyến khởi hành
 *  đúng hôm nay chưa thể tính là đã xong. */
function isUpcoming(b: Booking, today: string): boolean {
  return b.departureStartDate >= today;
}

/** Đếm 4 ô dashboard từ danh sách booking + số lượng đã lưu (wishlist đếm
 *  riêng ở lib gọi, hàm này chỉ nhận số — thuần, không phụ thuộc shape wishlist). */
export function dashboardStats(bookings: Booking[], savedCount: number): DashboardStats {
  const today = todayDateString();
  const paid = bookings.filter((b) => b.status === 'PAID');
  const upcoming = paid.filter((b) => isUpcoming(b, today)).length;
  return {
    trips: paid.length,
    upcoming,
    completed: paid.length - upcoming,
    saved: savedCount,
  };
}

/**
 * Booking `PAID` có `departureStartDate` gần nhất tính từ hôm nay (bao gồm
 * hôm nay) — thẻ "chuyến kế tiếp" dashboard (spec §3). `null` khi không có
 * booking `PAID` nào sắp tới.
 */
export function nextTrip(bookings: Booking[]): Booking | null {
  const today = todayDateString();
  const upcoming = bookings.filter((b) => b.status === 'PAID' && isUpcoming(b, today));
  if (upcoming.length === 0) return null;
  return upcoming.reduce((nearest, b) =>
    b.departureStartDate < nearest.departureStartDate ? b : nearest,
  );
}

/**
 * N booking sắp tới gần nhất cho dashboard (Task 3, spec §3 "5 booking sắp
 * tới") — gồm CẢ `PENDING` (cần thanh toán) và `PAID` (đã xác nhận), KHÁC
 * `dashboardStats`/`nextTrip` phía trên (chỉ đếm `PAID` cho 3 ô số + thẻ
 * "chuyến kế tiếp"). Lý do khác nhau: dashboard cần liệt kê việc CẦN CHÚ Ý —
 * booking PENDING chưa trả tiền vẫn đáng nhắc khách, còn 3 ô số/thẻ nextTrip
 * chỉ đo "chuyến sẽ đi THẬT" (tiền đã xác nhận). Sắp theo `departureStartDate`
 * tăng dần (gần nhất trước) rồi cắt đúng `limit`.
 */
export function upcomingBookings(bookings: Booking[], limit: number): Booking[] {
  const today = todayDateString();
  return bookings
    .filter((b) => (b.status === 'PENDING' || b.status === 'PAID') && isUpcoming(b, today))
    .sort((a, b) => {
      if (a.departureStartDate < b.departureStartDate) return -1;
      if (a.departureStartDate > b.departureStartDate) return 1;
      return 0;
    })
    .slice(0, limit);
}
