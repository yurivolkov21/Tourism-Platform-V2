/**
 * Số học và nhãn của THÁNG LỊCH — phần dùng chung của mọi ô chọn tháng phía
 * admin.
 *
 * Tách khỏi `reports-query.ts` ở F11 (21/09) khi có consumer thứ hai: bộ lọc
 * "tháng khởi hành" của `/tours` cần đúng phép cộng tháng và đúng nhãn ấy,
 * chỉ khác chiều (tới TƯƠNG LAI thay vì lùi về quá khứ). Hai bản số học tháng
 * là hai thứ sẽ trôi lệch nhau — cùng lý do `CalendarMonthSchema` chỉ có một
 * bản ở contract. `reports-query.ts` re-export lại để mọi chỗ import từ đó
 * không phải đổi gì.
 *
 * Bất biến của cả file: KHÔNG có `Date` nào tham gia phép tính tháng, và
 * "bây giờ" luôn được TRUYỀN VÀO chứ không đọc lén — nhãn thuần lịch không
 * được kéo múi giờ của máy render vào.
 */

/** Tên tháng đầy đủ (English, luật 7) — đọc bằng tay để KHÔNG qua `Intl`
 *  với một `Date` giả, thứ sẽ kéo múi giờ máy vào một nhãn thuần lịch. */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Tháng UTC của một mốc, dạng `YYYY-MM`. */
export function currentMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** `2026-09` → `September 2026`. */
export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

/** Một tháng lịch, đơn vị `YYYY-MM`, để trượt tới/lui mà không đụng `Date`. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  // Đếm theo tổng số tháng rồi tách lại — không có ca riêng nào cho mốc giao
  // năm, và không `Date` nào tham gia nên không có múi giờ nào len vào.
  const total = year * 12 + (monthNumber - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Một mục trong ô chọn tháng. */
export interface MonthOption {
  value: string;
  label: string;
}

/** Một đoạn liên tiếp cùng năm trong danh sách tháng. */
export interface MonthOptionGroup {
  /**
   * Khoá React. Là tháng ĐẦU đoạn, không phải năm: danh sách có thể mở đầu
   * bằng một tháng chèn thêm ngoài dải, nên cùng một năm có thể thành hai
   * đoạn rời nhau, và hai `key` trùng là lỗi React thật.
   */
  key: string;
  year: string;
  months: MonthOption[];
}

/**
 * Cắt danh sách tháng thành các đoạn cùng năm, cho menu tháng (khuôn
 * `dropdown-menu-10`, user chốt 03/09) đặt separator giữa các năm.
 *
 * Gom theo ĐOẠN LIÊN TIẾP chứ không gom theo khoá: danh sách vào đã sắp sẵn
 * và có thể mở đầu bằng một tháng ngoài dải; gom-theo-khoá sẽ kéo tháng ấy
 * xuống dưới, làm menu không còn mở ra ở đúng tháng đang đọc.
 */
export function groupMonthOptions(options: MonthOption[]): MonthOptionGroup[] {
  const groups: MonthOptionGroup[] = [];

  for (const month of options) {
    const year = month.value.slice(0, 4);
    const last = groups.at(-1);
    if (last && last.year === year) last.months.push(month);
    else groups.push({ key: month.value, year, months: [month] });
  }

  return groups;
}
