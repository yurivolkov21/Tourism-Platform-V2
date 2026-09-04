/**
 * Đổi khoảng NGÀY LỊCH của `AdminBookingsListQuery` (`from`/`to`, dạng
 * `YYYY-MM-DD`) thành khoảng MỐC cho Prisma. Thuần, đứng ngoài service để test
 * được mọi biên mà không cần DB.
 *
 * Biên NỬA-MỞ `[from 00:00Z, to+1 ngày 00:00Z)` — cùng nếp với mọi cửa sổ của
 * `StatsService`:
 *
 * - `from` tính vào từ đúng 00:00:00.000 UTC của ngày đó;
 * - `to` tính vào TRỌN NGÀY, nên mốc chặn là 00:00 của ngày HÔM SAU và dùng
 *   `lt` — không phải `lte` một mốc 23:59:59, thứ sẽ bỏ rơi mọi row rơi vào
 *   giây cuối cùng;
 * - hai khoảng liền kề (`…-09-30` rồi `-10-01…`) khít nhau, không row nào bị
 *   đếm hai lần.
 *
 * Múi giờ: cột `created_at` là `timestamp` không tz và mọi đường ghi đều ghi
 * UTC (xem `stats-math.ts`), nên ngày lịch ở đây được hiểu là ngày UTC. Admin
 * chọn "01/09" thì nhận đúng những booking mà audit trail của API gọi là ngày
 * 01/09 — không phải theo giờ máy của người đang xem.
 *
 * Index: CỐ Ý không thêm migration nào. `bookings` đã có `@@index([status,
 * createdAt])` — nhánh hay dùng nhất của bộ lọc này (một trạng thái + một
 * khoảng ngày) đi thẳng vào đó. Nhánh "chỉ ngày, mọi trạng thái" quét bảng,
 * rẻ ở cỡ dữ liệu hiện tại; ngưỡng xem lại giống StatsService: ~10k row.
 */

import { startOfDayUtc } from './calendar-date.js';

const DAY_MS = 86_400_000;

/**
 * Chuyển từ `modules/bookings/` lên `lib/` 04/09: từ khi `/reviews` cũng lọc
 * theo khoảng ngày (ADR-0028 §AMEND 2), helper này phục vụ ba module, nên để
 * nó nằm trong module bookings là bắt hai module khác import chéo vào một
 * vùng nghiệp vụ chẳng liên quan.
 */

/** Khoảng đưa thẳng vào `where.createdAt`; `undefined` = không lọc ngày. */
export type CreatedAtRange = { gte?: Date; lt?: Date } | undefined;

/**
 * Contract đã canh định dạng và luật `from <= to` (400 khi ngược), nên hàm
 * này không kiểm lại — nó chỉ đổi đơn vị. Thiếu cả hai đầu thì trả `undefined`
 * để `where` không mọc thêm một object rỗng vô nghĩa.
 */
export function createdAtRange(from?: string, to?: string): CreatedAtRange {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: startOfDayUtc(from) } : {}),
    // Trọn ngày `to`: chặn ở 00:00 ngày kế tiếp.
    ...(to ? { lt: new Date(startOfDayUtc(to).getTime() + DAY_MS) } : {}),
  };
}
