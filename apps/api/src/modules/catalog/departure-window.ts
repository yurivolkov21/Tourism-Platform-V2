import { vietnamToday } from '@tourism/contract';
import { startOfDayUtc } from '../../lib/calendar-date.js';

/**
 * Cửa sổ đếm "chuyến còn mở" của bảng `/tours` admin (spec P4e-1 §3-F11).
 *
 * Trả thẳng hình dạng `where` của Prisma cho cột `@db.Date` (`gte`/`lt`, nửa
 * mở) — hàm THUẦN, không chạm DB, nên luật cửa sổ test được từng nhánh mà
 * không phải dựng Postgres.
 *
 * Hai chế độ, và đây là chỗ dễ sai nhất của cả tính năng:
 *
 * - **Không có `month`** → "từ hôm nay trở đi": cận dưới là 00:00 UTC của
 *   ngày HÔM NAY THEO GIỜ VIỆT NAM (ADR-0041 §7), không có cận trên. Thước
 *   UTC trần sẽ để một chuyến khởi hành hôm qua giờ VN còn được đếm tới
 *   06:59 sáng nay — cùng cái bẫy `catalog.service.ts` đã vá.
 * - **Có `month`** → đúng tháng lịch ấy, TUYỆT ĐỐI: không giao thêm với "từ
 *   hôm nay". Admin chọn tháng trước là đang hỏi "tháng ấy còn chuyến nào tôi
 *   quên đóng không" — giao với hôm nay sẽ luôn trả 0 và câu hỏi đó thành
 *   không hỏi được.
 *
 * Cận trên là MỐC ĐẦU tháng SAU chứ không phải ngày cuối tháng này: đếm số
 * ngày trong tháng là chỗ tháng 2 năm nhuận cắn.
 */
export function departureWindow(month: string | undefined, now: Date): { gte: Date; lt?: Date } {
  if (!month) return { gte: startOfDayUtc(vietnamToday(now)) };

  // `month` đã qua `CalendarMonthSchema` (năm khoá 1900–2099) nên `Date.UTC`
  // không rơi vào hai hành vi legacy ở biên — xem JSDoc của schema đó.
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  return {
    gte: new Date(Date.UTC(year, monthIndex, 1)),
    // `monthIndex + 1` = 12 ở tháng 12 → `Date.UTC` tự cuộn sang tháng 1 năm
    // sau. Không tự cộng năm bằng tay.
    lt: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}
