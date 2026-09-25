const MONTHS_SHORT = [
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
] as const;

/**
 * "5 Jul 2026" — `createdAt` là datetime ISO thật (khác ngày lịch date-only
 * của `departures.ts`), nên đọc qua `Date` là hợp lệ. Dùng getter UTC để kết
 * quả không phụ thuộc múi giờ máy chạy test/app.
 */
export function formatReviewDate(createdAt: string): string {
  const d = new Date(createdAt);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * "Yerin Oh" → "YO" (chữ đầu tên + chữ đầu họ cuối). Tên một từ → một chữ.
 * `authorName === null` (tài khoản đã xoá) → "?".
 */
export function reviewAuthorInitials(authorName: string | null): string {
  if (authorName === null) return '?';
  const words = authorName.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials === '' ? '?' : initials;
}

/**
 * % chiều rộng thanh phân bố sao — theo TỔNG số review (khớp bản vẽ D4: 1/3 và
 * 2/3 review ra đúng 33%/67%), KHÔNG theo mức cao nhất. `total <= 0` → 0, né
 * chia cho 0 khi tour chưa ai đánh giá.
 */
export function reviewBreakdownPercent(count: number, total: number): number {
  return total <= 0 ? 0 : (count / total) * 100;
}
