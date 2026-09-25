const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
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
const MONTHS_FULL = [
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
] as const;

/** Ghế tối thiểu để còn coi là "Almost full" (D3, khớp web `statusAlmostFull`). */
export const ALMOST_FULL_THRESHOLD = 3;

/**
 * `startDate`/`endDate` là ngày lịch (`YYYY-MM-DD`) — tách chuỗi rồi tính thứ
 * bằng `Date.UTC`, KHÔNG `new Date(chuỗi)` trực tiếp: chuỗi date-only bị hiểu
 * là UTC rồi hiển thị theo giờ máy, lệch một ngày ở múi giờ âm (cùng luật
 * `formatDialogDate` bên web, `apps/web/src/lib/tours.ts`).
 */
function dateParts(date: string) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as string;
  return { y, m, d, dow };
}

/** "Sat 26 Sep" — thứ + ngày + tháng viết tắt, không năm (D3 bản vẽ 24/09). */
export function formatDepartureDate(date: string): string {
  const p = dateParts(date);
  return `${p.dow} ${p.d} ${MONTHS_SHORT[p.m - 1]}`;
}

/**
 * "Wed 23 – Sat 26 Sep" — chỉ in tháng ở ngày đầu nếu KHÁC tháng ngày cuối
 * (đợt hiếm khi vắt qua tháng, nhưng vẫn phải đọc đúng khi nó xảy ra).
 */
export function formatDepartureRange(startDate: string, endDate: string): string {
  const s = dateParts(startDate);
  const e = dateParts(endDate);
  const startLabel = s.m === e.m ? `${s.dow} ${s.d}` : `${s.dow} ${s.d} ${MONTHS_SHORT[s.m - 1]}`;
  return `${startLabel} – ${e.dow} ${e.d} ${MONTHS_SHORT[e.m - 1]}`;
}

/** "September 2026" — nhãn nhóm tháng của danh sách đợt. */
export function formatDepartureMonth(date: string): string {
  const p = dateParts(date);
  return `${MONTHS_FULL[p.m - 1]} ${p.y}`;
}

export interface RawDeparture {
  id: string;
  startDate: string;
  endDate: string;
  seatsLeft: number;
  effectivePrice: string;
  compareAtPrice: string | null;
  bookable: boolean;
}

export interface DepartureGroup<T> {
  monthLabel: string;
  departures: T[];
}

/**
 * Gom đợt theo tháng của `startDate`, GIỮ NGUYÊN thứ tự API trả (đã sort theo
 * ngày) — nhóm liên tiếp trùng nhãn tháng, không tự sort lại.
 */
export function groupDeparturesByMonth<T extends { startDate: string }>(
  departures: readonly T[],
): DepartureGroup<T>[] {
  const groups: DepartureGroup<T>[] = [];
  for (const departure of departures) {
    const monthLabel = formatDepartureMonth(departure.startDate);
    const last = groups.at(-1);
    if (last?.monthLabel === monthLabel) last.departures.push(departure);
    else groups.push({ monthLabel, departures: [departure] });
  }
  return groups;
}
