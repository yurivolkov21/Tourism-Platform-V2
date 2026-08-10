import type { Booking } from '@tourism/contract';

/**
 * "Hôm nay" dạng `YYYY-MM-DD` (UTC) — cùng format thuần ngày với
 * `departureStartDate` (`z.iso.date()`, không giờ/múi giờ) nên so sánh
 * lexicographic (`>=`/`<`) là đủ đúng thứ tự thời gian, khỏi parse `Date`.
 */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Số mili-giây một ngày — dùng để đếm ngày, không phải để cộng giờ. */
const MS_PER_DAY = 86_400_000;

/**
 * Số ngày từ hôm nay tới ngày khởi hành. 0 = đi hôm nay, âm = đã qua.
 *
 * So theo NGÀY LỊCH UTC chứ không theo giờ máy: `departureStartDate` là
 * `@db.Date` (ngày lịch, không giờ), nên đem so với `new Date()` giờ địa
 * phương sẽ lệch một ngày ở các mốc gần nửa đêm — và lệch theo múi giờ của
 * người xem, tức cùng một booking hiện hai con số khác nhau ở hai máy.
 *
 * Trả về số ÂM khi chuyến đã qua thay vì kẹp về 0: chỗ gọi biết rõ nó muốn
 * hiện gì cho ca đó hơn là hàm này.
 */
export function daysUntilDeparture(departureStartDate: string): number {
  const from = Date.parse(`${todayDateString()}T00:00:00.000Z`);
  const to = Date.parse(`${departureStartDate}T00:00:00.000Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

/** Ba nhóm thời gian của `/account/bookings`. */
export interface BookingGroups {
  onTheRoad: Booking[];
  upcoming: Booking[];
  past: Booking[];
}

/**
 * Chia booking thành ba nhóm theo thời gian, cho trang `/account/bookings`
 * sau redesign. Danh sách phẳng sắp theo một trục không nói được điều quan
 * trọng nhất: chuyến nào đang diễn ra NGAY BÂY GIỜ.
 *
 * Hai luật không thuần-ngày, và cả hai đều là chuyện đúng-sai chứ không phải
 * chuyện sắp xếp:
 *
 * - `CANCELLED` LUÔN vào "đã qua", kể cả khi ngày còn ở tương lai. Xếp một
 *   chuyến đã huỷ vào "sắp tới" là hứa thứ sẽ không xảy ra.
 * - Chỉ `PAID` mới được coi là "đang đi". Booking `PENDING` KHÔNG giữ chỗ
 *   (bất biến #1), nên dù ngày đã tới thì gọi nó là "đang đi" vẫn sai sự
 *   thật; để ở "sắp tới" kèm nhãn "Awaiting payment" mới đúng mức khẩn.
 *
 * Biên đóng hai đầu: chuyến khởi hành đúng hôm nay chưa thể là "sắp tới",
 * chuyến kết thúc đúng hôm nay chưa thể là "đã qua".
 *
 * Sắp ngược chiều nhau có chủ đích: "sắp tới" gần nhất trước (việc cần lo
 * sớm nhất), "đã qua" mới nhất trước (ký ức gần nhất).
 */
export function groupBookingsByTime(bookings: Booking[]): BookingGroups {
  const today = todayDateString();
  const groups: BookingGroups = { onTheRoad: [], upcoming: [], past: [] };

  for (const b of bookings) {
    if (b.status === 'CANCELLED' || b.departureEndDate < today) groups.past.push(b);
    else if (b.status === 'PAID' && b.departureStartDate <= today) groups.onTheRoad.push(b);
    else groups.upcoming.push(b);
  }

  const byStart = (a: Booking, b: Booking) =>
    a.departureStartDate.localeCompare(b.departureStartDate);
  groups.onTheRoad.sort(byStart);
  groups.upcoming.sort(byStart);
  groups.past.sort((a, b) => byStart(b, a));
  return groups;
}
