// Tên tháng và thứ viết tắt cho các hàm in ngày tự dựng của web ("14 Sep 2026", "Mon, 14 Sep",
// tem "Jul 2026" ở hộ chiếu). W-09 (15/10): trước đây năm bản chép tay nằm rải trong
// `apps/web` (`lib/tours.ts` hai bản, `lib/tour-detail.ts`, `lib/passport.ts`,
// `itinerary-panel.tsx`); nay cùng đọc ở đây theo luật 7.
//
// Module riêng, KHÔNG gắn vào `messages`: chỗ gọi phần lớn là hàm thuần trong `lib/`, cần đúng
// hai mảng này chứ không cần cả catalogue (cùng lý do tách `resilience.ts`).
//
// Thứ tự mảng là hợp đồng: phần tử 0 là tháng 1 và Chủ nhật, khớp `getUTCMonth()` và
// `getUTCDay()`. Chỗ gọi tự lo múi giờ (tách chuỗi `YYYY-MM-DD` hoặc đọc theo UTC).
export const dateNames = {
  monthShort: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ] as readonly string[],
  weekdayShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as readonly string[],
};
